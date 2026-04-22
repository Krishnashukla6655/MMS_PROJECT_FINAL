const express = require('express');
const router  = express.Router();
const { chat } = require('../ai/chatbot');

// Optional auth — chatbot works for guests AND logged-in users
function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) { req.user = null; return next(); }
  try {
    const jwt = require('jsonwebtoken');
    req.user  = jwt.verify(token, process.env.JWT_SECRET);
  } catch { req.user = null; }
  next();
}

// Store conversation context per session (simple in-memory)
const sessions = new Map();

router.post('/', optionalAuth, async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message) return res.status(400).json({ reply: 'Please say something!' });

  const userId  = req.user?.id || null;
  const isAdmin = req.user?.role === 'admin';

  // Get/create session
  const sid = sessionId || 'anon-' + Date.now();
  if (!sessions.has(sid)) {
    sessions.set(sid, { history: [], created: Date.now() });
  }
  const session = sessions.get(sid);
  session.history.push({ role: 'user', text: message, time: Date.now() });

  // Get AI response
  const result = await chat(message, userId, isAdmin);

  session.history.push({ role: 'assistant', text: result.reply, time: Date.now() });

  // Cleanup old sessions (>1hr)
  const oneHour = 3600000;
  for (const [key, val] of sessions) {
    if (Date.now() - val.created > oneHour) sessions.delete(key);
  }

  res.json({
    reply:     result.reply,
    intent:    result.intent,
    sessionId: sid,
    timestamp: Date.now()
  });
});

module.exports = router;
