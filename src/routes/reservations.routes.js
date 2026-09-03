import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { audit } from '../audit.js';
import {
  uuid, optionalUuid, optionalStr, oneOf, optionalOneOf, int, optionalInt,
  timestamp, pageLimit, pageOffset, notFound, badRequest,
} from '../validate.js';

const router = Router();
router.use(requireAuth);

const STATUSES = ['pending', 'confirmed', 'cancelled'];
const SOURCES = ['whatsapp', 'instagram', 'facebook', 'voice', 'call', 'manual'];

router.get('/', async (req, res, next) => {
  try {
    const rid = req.user.restaurantId;
    const status = optionalOneOf(req.query.status, STATUSES, 'الحالة');
    const branchId = optionalUuid(req.query.branchId, 'معرّف الفرع');
    const from = req.query.from ? timestamp(req.query.from, 'من تاريخ') : null;
    const to = req.query.to ? timestamp(req.query.to, 'إلى تاريخ') : null;
    const limit = pageLimit(req.query.limit);
    const offset = pageOffset(req.query.offset);

    const { rows } = await query(
      `SELECT res.id, res.reservation_time, res.guests, res.duration_minutes,
              res.source, res.status, res.notes, res.special_requests, res.created_at,
              b.id AS branch_id, b.name AS branch_name,
              c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone,
              c.classification AS customer_classification,
              count(*) OVER () AS total_count
         FROM reservations res
         JOIN branches  b ON b.id = res.branch_id
         JOIN customers c ON c.id = res.customer_id
        WHERE res.restaurant_id = $1
          AND ($2::text IS NULL OR res.status = $2)
          AND ($3::uuid IS NULL OR res.branch_id = $3)
          AND ($4::timestamptz IS NULL OR res.reservation_time >= $4)
          AND ($5::timestamptz IS NULL OR res.reservation_time <= $5)
        ORDER BY res.reservation_time DESC
        LIMIT $6 OFFSET $7`,
      [rid, status, branchId, from, to, limit, offset]
    );

    res.json({
      total: rows[0]?.total_count ?? 0,
      items: rows.map(({ total_count, ...r }) => r),
    });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const rid = req.user.restaurantId;
    const body = req.body ?? {};

    const branchId = uuid(body.branchId, 'معرّف الفرع');
    const reservationTime = timestamp(body.reservationTime, 'وقت الحجز');
    const guests = int(body.guests, 'عدد الأفراد', { min: 1, max: 500 });
    const source = body.source === undefined ? 'manual' : oneOf(body.source, SOURCES, 'المصدر');
    const status = body.status === undefined ? 'pending' : oneOf(body.status, STATUSES, 'الحالة');
    const notes = optionalStr(body.notes, 'ملاحظات', { max: 1000 });
    const specialRequests = optionalStr(body.specialRequests, 'طلبات خاصة', { max: 1000 });
    const durationMinutes = optionalInt(body.durationMinutes, 'المدة بالدقائق', { min: 15, max: 720 });

    await assertBranch(branchId, rid);
    const customerId = await resolveCustomer(rid, body);

    const { rows } = await query(
      `INSERT INTO reservations
         (restaurant_id, branch_id, customer_id, reservation_time, guests,
          duration_minutes, source, status, notes, special_requests)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, reservation_time, guests, status, source, created_at`,
      [rid, branchId, customerId, reservationTime, guests, durationMinutes,
       source, status, notes, specialRequests]
    );

    await audit(req, {
      action: 'reservation.create', entityType: 'reservation', entityId: rows[0].id,
      payload: { branchId, customerId, reservationTime, guests, source, status },
    });
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = uuid(req.params.id, 'معرّف الحجز');
    const rid = req.user.restaurantId;
    const body = req.body ?? {};

    const status = body.status === undefined ? null : oneOf(body.status, STATUSES, 'الحالة');
    const reservationTime = body.reservationTime === undefined
      ? null : timestamp(body.reservationTime, 'وقت الحجز');
    const guests = body.guests === undefined
      ? null : int(body.guests, 'عدد الأفراد', { min: 1, max: 500 });
    const notes = body.notes === undefined ? undefined : optionalStr(body.notes, 'ملاحظات', { max: 1000 });
    const branchId = body.branchId === undefined ? null : uuid(body.branchId, 'معرّف الفرع');

    if (branchId) await assertBranch(branchId, rid);

    const { rows } = await query(
      `UPDATE reservations
          SET status           = COALESCE($3, status),
              reservation_time = COALESCE($4, reservation_time),
              guests           = COALESCE($5, guests),
              branch_id        = COALESCE($6, branch_id),
              notes            = CASE WHEN $7::boolean THEN $8::text ELSE notes END
        WHERE id = $1 AND restaurant_id = $2
        RETURNING id, reservation_time, guests, status, branch_id, notes`,
      [id, rid, status, reservationTime, guests, branchId, notes !== undefined, notes ?? null]
    );
    if (!rows[0]) throw notFound('الحجز غير موجود.');

    await audit(req, {
      action: 'reservation.update', entityType: 'reservation', entityId: id,
      payload: { status, reservationTime, guests, branchId },
    });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

async function assertBranch(branchId, restaurantId) {
  const { rowCount } = await query(
    'SELECT 1 FROM branches WHERE id = $1 AND restaurant_id = $2 AND deleted_at IS NULL',
    [branchId, restaurantId]
  );
  if (!rowCount) throw notFound('الفرع غير موجود.');
}

/** يقبل customerId جاهز، أو رقم تليفون فيُنشئ/يجلب العميل. */
async function resolveCustomer(restaurantId, body) {
  const existing = optionalUuid(body.customerId, 'معرّف العميل');
  if (existing) {
    const { rowCount } = await query(
      'SELECT 1 FROM customers WHERE id = $1 AND restaurant_id = $2',
      [existing, restaurantId]
    );
    if (!rowCount) throw notFound('العميل غير موجود.');
    return existing;
  }

  const phone = optionalStr(body.customerPhone, 'رقم العميل', { max: 32 });
  if (!phone) throw badRequest('لازم تحدد العميل (معرّف أو رقم تليفون).');
  const name = optionalStr(body.customerName, 'اسم العميل', { max: 200 });

  const { rows } = await query(
    `INSERT INTO customers (restaurant_id, phone, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (restaurant_id, phone)
       DO UPDATE SET name = COALESCE(customers.name, EXCLUDED.name)
     RETURNING id`,
    [restaurantId, phone, name]
  );
  return rows[0].id;
}

export default router;
