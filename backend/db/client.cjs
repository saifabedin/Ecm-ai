const pkg = require("pg");
const { Pool } = pkg;

let pool = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' && process.env.DB_SSL !== 'false'
      ? { rejectUnauthorized: true }
      : { rejectUnauthorized: false },
  });
} else {
  console.log("⚠️ DATABASE_URL missing — DB disabled");
}

module.exports = pool;
