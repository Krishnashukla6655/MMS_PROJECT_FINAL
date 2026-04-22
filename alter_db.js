const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function migrate() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: process.env.DB_PASSWORD || '',
      database: 'mms_db'
    });
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'general',
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    
    console.log('user_notifications table created successfully.');
    await connection.end();
  } catch (err) {
    console.error('Migration failed:', err);
  }
}
migrate();
