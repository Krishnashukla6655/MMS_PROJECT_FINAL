require('dotenv').config();
const db = require('./db');

async function migrate() {
  try {
    console.log('--- Starting Auth Migration ---');

    const columns = [
      'google_id VARCHAR(255) DEFAULT NULL',
      'facebook_id VARCHAR(255) DEFAULT NULL',
      'apple_id VARCHAR(255) DEFAULT NULL',
      'vk_id VARCHAR(255) DEFAULT NULL',
      'mobile_number VARCHAR(20) DEFAULT NULL',
      'otp_code VARCHAR(10) DEFAULT NULL',
      'otp_expires_at DATETIME DEFAULT NULL'
    ];

    for (const col of columns) {
      const colName = col.split(' ')[0];
      try {
        console.log(`Adding column: ${colName}...`);
        await db.query(`ALTER TABLE users ADD COLUMN ${col}`);
      } catch (e) {
        if (e.code === 'ER_DUP_COLUMN_NAME') {
          console.log(`Column ${colName} already exists, skipping.`);
        } else {
          throw e;
        }
      }
    }

    // Special case for password modification
    await db.query(`ALTER TABLE users MODIFY COLUMN password VARCHAR(255) DEFAULT NULL`);

    console.log('✅ Migration successful!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
