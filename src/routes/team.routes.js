import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole, hashPassword, ROLE_RANK } from '../auth.js';
import { audit } from '../audit.js';
import {
  uuid, optionalUuid, str, oneOf, bool, notFound, badRequest,
} from '../validate.js';

const router = Router();
router.use(requireAuth);

const ROLES = ['owner', 'manager', 'staff'];

// ---------- الفروع ----------

router.get('/branches', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT b.id, b.name, b.address, b.open_hours, b.active, b.created_at,
              (SELECT count(*) FROM reservations r
                WHERE r.branch_id = b.id AND r.reservation_time >= now()) AS upcoming_reservations
         FROM branches b
        WHERE b.restaurant_id = $1 AND b.deleted_at IS NULL
        ORDER BY b.created_at`,
      [req.user.restaurantId]
    );
    res.json({ items: rows });
  } catch (err) { next(err); }
});

router.post('/branches', requireRole('owner'), async (req, res, next) => {
  try {
    const name = str(req.body?.name, 'اسم الفرع', { max: 200 });
    const address = req.body?.address ? str(req.body.address, 'العنوان', { max: 500 }) : null;
    const { rows } = await query(
      `INSERT INTO branches (restaurant_id, name, address)
       VALUES ($1,$2,$3) RETURNING id, name, address, active, created_at`,
      [req.user.restaurantId, name, address]
    );
    await audit(req, {
      action: 'branch.create', entityType: 'branch', entityId: rows[0].id, payload: { name },
    });
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/branches/:id', requireRole('owner'), async (req, res, next) => {
  try {
    const id = uuid(req.params.id, 'معرّف الفرع');
    const body = req.body ?? {};
    const name = body.name === undefined ? null : str(body.name, 'اسم الفرع', { max: 200 });
    const address = body.address === undefined ? undefined
      : (body.address ? str(body.address, 'العنوان', { max: 500 }) : null);
    const active = body.active === undefined ? null : bool(body.active, 'التفعيل');

    const { rows } = await query(
      `UPDATE branches
          SET name    = COALESCE($3, name),
              address = CASE WHEN $4::boolean THEN $5::text ELSE address END,
              active  = COALESCE($6, active)
        WHERE id = $1 AND restaurant_id = $2 AND deleted_at IS NULL
        RETURNING id, name, address, active`,
      [id, req.user.restaurantId, name, address !== undefined, address ?? null, active]
    );
    if (!rows[0]) throw notFound('الفرع غير موجود.');
    await audit(req, {
      action: 'branch.update', entityType: 'branch', entityId: id, payload: { name, active },
    });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ---------- المستخدمون ----------

router.get('/users', requireRole('manager'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.role, u.active, u.last_login_at, u.created_at,
              b.name AS branch_name
         FROM users u
         LEFT JOIN branches b ON b.id = u.branch_id
        WHERE u.restaurant_id = $1
        ORDER BY CASE u.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, u.name`,
      [req.user.restaurantId]
    );
    res.json({ items: rows });
  } catch (err) { next(err); }
});

router.post('/users', requireRole('owner'), async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const name = str(body.name, 'الاسم', { max: 200 });
    const email = str(body.email, 'البريد الإلكتروني', { max: 200 }).toLowerCase();
    const role = oneOf(body.role, ROLES, 'الدور');
    const branchId = optionalUuid(body.branchId, 'معرّف الفرع');
    const passwordHash = await hashPassword(body.password);

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw badRequest('البريد الإلكتروني غير صالح.');
    }

    const { rows } = await query(
      `INSERT INTO users (restaurant_id, branch_id, name, email, password_hash, role)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, name, email, role, active, created_at`,
      [req.user.restaurantId, branchId, name, email, passwordHash, role]
    ).catch((err) => {
      if (err.code === '23505') throw badRequest('البريد الإلكتروني مستخدم بالفعل.');
      throw err;
    });

    await audit(req, {
      action: 'user.create', entityType: 'user', entityId: rows[0].id, payload: { email, role },
    });
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/users/:id', requireRole('owner'), async (req, res, next) => {
  try {
    const id = uuid(req.params.id, 'معرّف المستخدم');
    const body = req.body ?? {};
    const rid = req.user.restaurantId;

    const name = body.name === undefined ? null : str(body.name, 'الاسم', { max: 200 });
    const role = body.role === undefined ? null : oneOf(body.role, ROLES, 'الدور');
    const active = body.active === undefined ? null : bool(body.active, 'التفعيل');
    const passwordHash = body.password === undefined ? null : await hashPassword(body.password);

    // لا يجوز للمالك أن يوقف نفسه أو ينزّل دوره — عشان المطعم ما يقفلش على نفسه.
    if (id === req.user.id && (active === false || (role && ROLE_RANK[role] < ROLE_RANK.owner))) {
      throw badRequest('مينفعش توقف حسابك أو تغيّر دورك بنفسك.');
    }

    const { rows } = await query(
      `UPDATE users
          SET name = COALESCE($3, name),
              role = COALESCE($4, role),
              active = COALESCE($5, active),
              password_hash = COALESCE($6, password_hash)
        WHERE id = $1 AND restaurant_id = $2
        RETURNING id, name, email, role, active`,
      [id, rid, name, role, active, passwordHash]
    );
    if (!rows[0]) throw notFound('المستخدم غير موجود.');

    await audit(req, {
      action: 'user.update', entityType: 'user', entityId: id,
      payload: { name, role, active, passwordChanged: passwordHash !== null },
    });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ---------- سجل العمليات ----------

router.get('/audit', requireRole('manager'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, actor, action, entity_type, entity_id, payload, created_at
         FROM audit_log
        WHERE restaurant_id = $1
        ORDER BY created_at DESC
        LIMIT 100`,
      [req.user.restaurantId]
    );
    res.json({ items: rows });
  } catch (err) { next(err); }
});

// ---------- بيانات المطعم ----------

router.get('/restaurant', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, currency, timezone, active,
              whatsapp_phone_number_id IS NOT NULL AS whatsapp_connected, created_at
         FROM restaurants WHERE id = $1`,
      [req.user.restaurantId]
    );
    if (!rows[0]) throw notFound('المطعم غير موجود.');
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/restaurant', requireRole('owner'), async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const name = body.name === undefined ? null : str(body.name, 'اسم المطعم', { max: 200 });
    const currency = body.currency === undefined
      ? null : oneOf(body.currency, ['EGP', 'SAR', 'AED'], 'العملة');
    const timezone = body.timezone === undefined
      ? null : str(body.timezone, 'المنطقة الزمنية', { max: 64 });

    const { rows } = await query(
      `UPDATE restaurants
          SET name = COALESCE($2, name),
              currency = COALESCE($3, currency),
              timezone = COALESCE($4, timezone)
        WHERE id = $1
        RETURNING id, name, currency, timezone`,
      [req.user.restaurantId, name, currency, timezone]
    ).catch((err) => {
      if (err.code === '22023' || err.code === '22007') {
        throw badRequest('المنطقة الزمنية غير صالحة.');
      }
      throw err;
    });
    if (!rows[0]) throw notFound('المطعم غير موجود.');

    await audit(req, {
      action: 'restaurant.update', entityType: 'restaurant', entityId: req.user.restaurantId,
      payload: { name, currency, timezone },
    });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

export default router;
