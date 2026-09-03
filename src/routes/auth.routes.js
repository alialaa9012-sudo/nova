import { Router } from 'express';
import { query } from '../db.js';
import {
  verifyCredentials, issueToken, setSessionCookie, clearSessionCookie, requireAuth,
} from '../auth.js';
import { audit } from '../audit.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    const result = await verifyCredentials(email, password);

    if (!result.ok) {
      const message = result.reason === 'bad_credentials'
        ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
        : 'هذا الحساب غير مفعّل. تواصل مع صاحب المطعم.';
      return res.status(401).json({ error: result.reason, message });
    }

    const { user } = result;
    setSessionCookie(res, issueToken(user));

    await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
    req.user = { restaurantId: user.restaurant_id, email: user.email };
    await audit(req, { action: 'auth.login', entityType: 'user', entityId: user.id });

    res.json({ user: publicUser(user) });
  } catch (err) { next(err); }
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await audit(req, { action: 'auth.logout', entityType: 'user', entityId: req.user.id });
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.restaurant_id, u.branch_id, u.name, u.email, u.role, u.active,
              r.name AS restaurant_name, r.currency, r.timezone
         FROM users u
         JOIN restaurants r ON r.id = u.restaurant_id
        WHERE u.id = $1`,
      [req.user.id]
    );
    const user = rows[0];
    if (!user || !user.active) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'unauthorized' });
    }
    res.json({ user: publicUser(user) });
  } catch (err) { next(err); }
});

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    branchId: u.branch_id ?? null,
    restaurant: {
      id: u.restaurant_id,
      name: u.restaurant_name,
      currency: u.currency,
      timezone: u.timezone,
    },
  };
}

export default router;
