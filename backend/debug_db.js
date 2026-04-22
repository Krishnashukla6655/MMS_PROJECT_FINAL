require('dotenv').config();
const db = require('./db');

async function debug() {
  try {
    const [rows] = await db.query('DESCRIBE users');
    console.table(rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
debug();
