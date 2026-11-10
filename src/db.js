import { createRequire } from 'node:module';
import pg from 'pg';

const require = createRequire(import.meta.url);

// Neon يرجّع numeric كنص افتراضيًا — نحوّله لرقم عشان الواجهة تحسب صح.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
// bigint (count) -> number
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

const { Pool } = pg;

let pool;

/**
 * بعض البيئات بتقفل الاتصال المباشر بقاعدة البيانات (بورت 5432) وتسمح بـ HTTPS بس.
 * لما NOVA_DB_HTTP=1 بنستخدم اتصال Neon عبر HTTPS بدل الاتصال المباشر.
 * نفس الاستعلامات ونفس النتائج — الفرق في طريقة النقل بس.
 */
function createHttpPool(connectionString) {
  const { neon, neonConfig } = require('@neondatabase/serverless');
  const host = new URL(connectionString.replace(/^postgres(ql)?:/, 'http:')).hostname;
  neonConfig.fetchEndpoint = `https://${host}/sql`;
  const sql = neon(connectionString);

  const run = async (text, params = []) => {
    const rows = await sql.query(text, params);
    return { rows, rowCount: rows.length };
  };

  return {
    query: run,
    // الـ HTTP driver مابيدعمش transactions متعددة الخطوات،
    // فبننفّذ الاستعلامات بالترتيب. كافي للوحة التحكم.
    connect: async () => ({ query: run, release() {} }),
    end: async () => {},
  };
}

/** Pool واحد للتطبيق كله. */
export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL غير موجود. انسخ .env.example إلى .env وضع رابط قاعدة البيانات من Neon.'
      );
    }

    if (process.env.NOVA_DB_HTTP === '1') {
      pool = createHttpPool(connectionString);
      return pool;
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
  const transactional = typeof client.release === 'function' && process.env.NOVA_DB_HTTP !== '1';
  try {
    if (transactional) await client.query('BEGIN');
    const result = await fn(client);
    if (transactional) await client.query('COMMIT');
    return result;
  } catch (err) {
    if (transactional) await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** للاختبارات: استبدال الـ pool بكائن وهمي. */
export function __setPool(fake) {
  pool = fake;
}
