const db = require('../db');
const { GoogleGenAI } = require('@google/genai');

// In-memory store for session history
const sessions = {};

// Initialize Gemini if key exists
let ai = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

const systemInstruction = `
You are an advanced AI assistant for MMS Industries (Manufacturing Management System).
You can understand any language, but you should prioritize replying in the same language the user speaks.
Your personality: Professional, highly intelligent, concise, and helpful. 
You act like a highly capable executive assistant (like Jarvis or Friday).

You have autonomous tools at your disposal:
1. 'get_products': Use this if the user asks what products are available.
2. 'get_my_orders': Use this if the user asks about their recent orders.
3. 'place_order': Use this to place an order. If the user asks to place an order but doesn't specify the product, quantity, or payment method (cod, upi, card), you MUST ask them for the missing details before calling the tool.

If the user asks general knowledge questions, answer them intelligently using your vast knowledge. 
If they ask about manufacturing, you are an expert.
Always format your responses with clean Markdown (bolding, lists, etc.) for readability.
`;

const toolsConfig = [{
  functionDeclarations: [
    {
      name: 'place_order',
      description: 'Places a new order for a product. Use only when product, quantity, and payment method are known.',
      parameters: {
        type: 'OBJECT',
        properties: {
          product_name: { type: 'STRING', description: 'Name of the product' },
          quantity: { type: 'INTEGER', description: 'Quantity to order' },
          payment_method: { type: 'STRING', enum: ['cod', 'upi', 'card'], description: 'Payment method' }
        },
        required: ['product_name', 'quantity', 'payment_method']
      }
    },
    {
      name: 'get_products',
      description: 'Fetches the list of all available products with their prices and stock.',
      parameters: { type: 'OBJECT', properties: {} }
    },
    {
      name: 'get_my_orders',
      description: 'Fetches the recent orders placed by the current logged-in user.',
      parameters: { type: 'OBJECT', properties: {} }
    },
    {
      name: 'get_attendance_stats',
      description: 'Fetches today\'s employee attendance statistics (Present, Absent, Total). Can only be used by Admins.',
      parameters: { type: 'OBJECT', properties: {} }
    }
  ]
}];

// ── TOOL IMPLEMENTATIONS ──

async function get_products() {
  try {
    const [rows] = await db.query('SELECT name, description, price, unit, stock_quantity FROM products LIMIT 10');
    return rows.length ? JSON.stringify(rows) : "No products available.";
  } catch (e) { return "Error fetching products: " + e.message; }
}

async function get_my_orders(userId) {
  if (!userId) return "User is not logged in. Tell them they must be logged in to view orders.";
  try {
    const [rows] = await db.query('SELECT id, total_amount, status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [userId]);
    return rows.length ? JSON.stringify(rows) : "You have no recent orders.";
  } catch (e) { return "Error fetching orders."; }
}

async function get_attendance_stats(userRole) {
  if (userRole !== 'admin') return "ACCESS DENIED: You must inform the user that they are not authorized to view employee attendance statistics.";
  try {
    const today = new Date().toISOString().split('T')[0];
    const [stats] = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN status IS NULL THEN 1 ELSE 0 END) as unmarked
      FROM users u
      LEFT JOIN attendance a ON u.id = a.user_id AND a.date = ?
      WHERE u.role = 'employee'
    `, [today]);
    const s = stats[0];
    return `Today's Attendance: Total: ${s.total}, Present: ${s.present || 0}, Absent: ${s.absent || 0}, Unmarked: ${s.unmarked || 0}. Format this beautifully.`;
  } catch (e) { return "Error fetching attendance."; }
}

async function place_order(args, userId) {
  if (!userId) return "Error: Tell the user they must be logged in to place an order.";
  const { product_name, quantity, payment_method } = args;
  
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    
    // 1. Find product
    const [prods] = await conn.query('SELECT * FROM products WHERE name LIKE ? FOR UPDATE', [`%${product_name}%`]);
    if (!prods.length) throw new Error(`Product matching '${product_name}' not found in the catalog.`);
    const p = prods[0];
    
    // 2. Validate stock and bulk constraints
    if (quantity < p.min_bulk_qty) throw new Error(`Minimum bulk order for ${p.name} is ${p.min_bulk_qty} ${p.unit}.`);
    if (quantity > p.stock_quantity) throw new Error(`Insufficient stock for ${p.name}. Only ${p.stock_quantity} available.`);
    
    // 3. Insert order
    const totalAmount = p.price * quantity;
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substr(2, 5).toUpperCase();
    const confirmationNumber = `MMS-${ts}-${rand}`;
    
    const [orderRes] = await conn.query(
      'INSERT INTO orders (user_id, total_amount, status, confirmation_number, payment_method) VALUES (?, ?, ?, ?, ?)',
      [userId, totalAmount, 'confirmed', confirmationNumber, payment_method]
    );
    
    await conn.query('INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)', [orderRes.insertId, p.id, quantity, p.price]);
    await conn.query('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [quantity, p.id]);
    
    await conn.commit();
    return `SUCCESS: Order placed! Confirmation Number: ${confirmationNumber}. Total: ₹${totalAmount}. Product: ${p.name}. Tell the user the order was successful and give them these details.`;
  } catch(e) {
    await conn.rollback();
    return "Error placing order: " + e.message;
  } finally {
    conn.release();
  }
}

// ── MAIN CHAT HANDLER ──

async function processChat(req, res) {
  const { message, sessionId = 'default', aiName = 'Jarvis' } = req.body;
  const userId = req.user ? req.user.id : null;

  if (!message) return res.status(400).json({ error: 'Message is required' });

  // Fallback if no API Key
  if (!ai) {
    return res.json({ reply: "⚠️ **SYSTEM ALERT:** My True Generative AI brain is offline. I am currently operating without a `GEMINI_API_KEY`. Please add it to your `backend/.env` file and restart the server!" });
  }

  const systemInstruction = `
You are ${aiName}, an incredibly advanced, highly sophisticated artificial intelligence.
You act exactly like the AI from Iron Man. You are calm, highly capable, and exquisitely polite.
Always refer to the user respectfully as "Sir" or "Boss".
If asked to introduce yourself, do so formally. (If Jarvis: "I am J.A.R.V.I.S., Just A Rather Very Intelligent System." If Friday: "I am F.R.I.D.A.Y., Female Replacement Intelligent Digital Assistant Youth.")

You have autonomous tools at your disposal to manage MMS Industries:
1. 'get_products': Use this to check the catalog.
2. 'get_my_orders': Use this to check the user's recent orders.
3. 'place_order': Use this to place an order. If the user doesn't specify product, quantity, or payment method (cod, upi, card), ask them politely before calling the tool.
4. 'get_attendance_stats': Use this to get employee attendance data (Admin only).

Answer all general knowledge questions with immense intelligence and a sophisticated tone. Always use Markdown for readability.
`;

  // Initialize session history if not exists
  if (!sessions[sessionId]) {
    sessions[sessionId] = [];
  }
  
  const history = sessions[sessionId];
  
  // Add user message to history
  history.push({ role: 'user', parts: [{ text: message }] });

  try {
    let response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: history,
      config: {
        systemInstruction: systemInstruction,
        tools: toolsConfig,
        temperature: 0.7
      }
    });

    let finalReply = '';

    // Handle Tool Calls autonomously
    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      const fnName = call.name;
      const fnArgs = call.args;

      let toolResult = '';
      if (fnName === 'get_products') toolResult = await get_products();
      else if (fnName === 'get_my_orders') toolResult = await get_my_orders(userId);
      else if (fnName === 'get_attendance_stats') toolResult = await get_attendance_stats(req.user ? req.user.role : null);
      else if (fnName === 'place_order') toolResult = await place_order(fnArgs, userId);
      else toolResult = "Unknown tool.";

      // Push the function call and result to history
      history.push({ role: 'model', parts: [{ functionCall: call }] });
      history.push({ role: 'user', parts: [{ functionResponse: { name: fnName, response: { result: toolResult } } }] });

      // Call Gemini again with the tool output to formulate the final answer
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: history,
        config: {
          systemInstruction: systemInstruction,
          tools: toolsConfig,
          temperature: 0.7
        }
      });
    }

    if (response.text) {
      finalReply = response.text;
      history.push({ role: 'model', parts: [{ text: finalReply }] });
    } else {
      finalReply = "I processed your request but didn't generate a text response.";
    }

    return res.json({ reply: finalReply });

  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.json({ reply: "⚠️ **Error:** I encountered a problem processing your request. Ensure your API key is correct and valid." });
  }
}

module.exports = {
  processChat
};
