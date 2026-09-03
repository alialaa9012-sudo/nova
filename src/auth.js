import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

const COOKIE_NAME = 'nova_session';
const SESSION_HOURS = 12;

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error('JWT_SECRET مفقود أو قصير جدًا (32 حرف على الأقل).');
  }
  return s;
}

/** صلاحيات كل دور. */
export const ROLE_RANK = { staff: 1, manager: 2, owner: 3 };

export function issueToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      rid: user.restaurant_id,
      bid: user.branch_id ?? null,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    secret(),
    { expiresIn: `${SESSION_HOURS}h` }
  );
}

export function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/**
 * تحقق من الإيميل وكلمة المرور مقابل جدول users.
 * الإيميل فريد على مستوى النظام (uniq_users_email على lower(email)).
 */
export async function verifyCredentials(email, password) {
  const { rows } = await query(
    `SELECT u.id, u.restaurant_id, u.branch_id, u.name, u.email, u.password_hash,
            u.role, u.active, r.name AS restaurant_name, r.currency, r.timezone,
            (r.active AND r.deleted_at IS NULL) AS restaurant_ok
       FROM users u
       JOIN restaurants r ON r.id = u.restaurant_id
      WHERE lower(u.email) = lower($1)
      LIMIT 1`,
    [String(email ?? '').trim()]
  );

  const user = rows[0];
  // نقارن دائمًا حتى لو المستخدم غير موجود، لتفادي تسريب وجود الحساب عبر فرق التوقيت.
  const hash = user?.password_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
  const ok = await bcrypt.compare(String(password ?? ''), hash);

  if (!user || !ok) return { ok: false, reason: 'bad_credentials' };
  if (!user.active) return { ok: false, reason: 'inactive' };
  if (!user.restaurant_ok) return { ok: false, reason: 'restaurant_inactive' };

  delete user.password_hash;
  return { ok: true, user };
}

export async function hashPassword(plain) {
  if (typeof plain !== 'string' || plain.length < 8) {
    throw Object.assign(new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل.'), { status: 400 });
  }
  return bcrypt.hash(plain, 10);
}

/** Middleware: يتطلب جلسة صالحة. */
export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const claims = jwt.verify(token, secret());
    req.user = {
      id: claims.sub,
      restaurantId: claims.rid,
      branchId: claims.bid,
      email: claims.email,
      name: claims.name,
      role: claims.role,
    };
    next();
  } catch {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'session_expired' });
  }
}

/** Middleware: يتطلب دور بمستوى معيّن أو أعلى. */
export function requireRole(minRole) {
  const min = ROLE_RANK[minRole];
  return (req, res, next) => {
    const rank = ROLE_RANK[req.user?.role] ?? 0;
    if (rank < min) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}
