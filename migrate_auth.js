require('dotenv').config({ path: './backend/.env' });
const db = require('./backend/db');

async function migrate() {
  try {
    console.log('--- Starting Auth Migration ---');

    const queries = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) DEFAULT NULL;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_id VARCHAR(255) DEFAULT NULL;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_id VARCHAR(255) DEFAULT NULL;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS vk_id VARCHAR(255) DEFAULT NULL;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(20) DEFAULT NULL;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(10) DEFAULT NULL;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at DATETIME DEFAULT NULL;`,
      `ALTER TABLE users MODIFY COLUMN password VARCHAR(255) DEFAULT NULL;` // Allow null password for social-only users
    ];

    for (const sql of queries) {
      console.log(`Executing: ${sql.slice(0, 50)}...`);
      await db.query(sql);
    }

    console.log('✅ Migration successful!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
