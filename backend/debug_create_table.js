require('dotenv').config();
const db = require('./db');

async function debug() {
  try {
    const [rows] = await db.query('SHOW CREATE TABLE users');
    console.log(rows[0]['Create Table']);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
debug();
