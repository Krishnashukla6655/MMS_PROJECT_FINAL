const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:            process.env.DB_HOST     || 'localhost',
  port:            process.env.DB_PORT     || 3306,
  user:            process.env.DB_USER     || 'root',
  password:        process.env.DB_PASSWORD || '',
  database:        process.env.DB_NAME     || 'mms_db',
  ssl: (process.env.DB_HOST && process.env.DB_HOST !== 'localhost') ? {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: false
  } : null,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit:      0,
  charset:         'utf8mb4'
});

// Test connection on startup


pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL connected successfully');
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err.message);
    console.error('   Check your .env DB_* variables and make sure MySQL is running.');
  });

module.exports = pool;
