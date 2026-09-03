import pg from 'pg';

// Neon يرجّع numeric كنص افتراضيًا — نحوّله لرقم عشان الواجهة تحسب صح.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
// bigint (count) -> number
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

const { Pool } = pg;

let pool;

/** Pool واحد للتطبيق كله. */
export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL غير موجود. انسخ .env.example إلى .env وضع رابط قاعدة البيانات من Neon.'
      );
    }
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: true },
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

/** تنفيذ استعلام واحد. */
export function query(text, params) {
  return getPool().query(text, params);
}

/** تنفيذ مجموعة استعلامات داخل transaction واحدة. */
export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** للاختبارات: استبدال الـ pool بكائن وهمي. */
export function __setPool(fake) {
  pool = fake;
}
