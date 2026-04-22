require('dotenv').config({ path: './backend/.env' });
const db = require('./backend/db');

async function debug() {
  try {
    const [rows] = await db.query('DESCRIBE users');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
debug();
