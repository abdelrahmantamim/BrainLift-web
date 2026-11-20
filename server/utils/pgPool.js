import pg from 'pg';
import dotenv from 'dotenv';
import logger from './serverLogger.js';

dotenv.config();

const { Pool } = pg;

// Single shared Postgres pool for all direct (non-Supabase) queries. Importing
// this everywhere avoids pool sprawl and per-request pools that exhaust the DB
// connection limit. Note: Better Auth keeps its own pool in config/ — do not
// route that through this one.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
});

// Without this handler an idle-client error (e.g. a transient DB disconnect)
// is emitted as an unhandled error and can crash the process.
pool.on('error', (err) => {
  logger.error('pgPool', 'Idle client error', err);
});

export async function closePool() {
  await pool.end();
}

export default pool;
