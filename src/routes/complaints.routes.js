import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { audit } from '../audit.js';
import {
  uuid, optionalUuid, str, oneOf, optionalOneOf, pageLimit, pageOffset, notFound,
} from '../validate.js';

const router = Router();
router.use(requireAuth);

const STATUSES = ['new', 'in_progress', 'resolved'];
const PRIORITIES = ['high', 'mid', 'low'];

router.get('/', async (req, res, next) => {
  try {
    const status = optionalOneOf(req.query.status, STATUSES, 'الحالة');
    const priority = optionalOneOf(req.query.priority, PRIORITIES, 'الأولوية');
    const limit = pageLimit(req.query.limit);
    const offset = pageOffset(req.query.offset);

    const { rows } = await query(
      `SELECT co.id, co.summary, co.priority, co.status, co.created_at, co.resolved_at,
              co.conversation_id,
              b.name AS branch_name,
              c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone,
              count(*) OVER () AS total_count
         FROM complaints co
         JOIN customers c ON c.id = co.customer_id
         LEFT JOIN branches b ON b.id = co.branch_id
        WHERE co.restaurant_id = $1
          AND ($2::text IS NULL OR co.status = $2)
          AND ($3::text IS NULL OR co.priority = $3)
        ORDER BY
          CASE co.priority WHEN 'high' THEN 0 WHEN 'mid' THEN 1 ELSE 2 END,
          co.created_at DESC
        LIMIT $4 OFFSET $5`,
      [req.user.restaurantId, status, priority, limit, offset]
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
    const customerId = uuid(body.customerId, 'معرّف العميل');
    const summary = str(body.summary, 'ملخص الشكوى', { max: 2000 });
    const priority = body.priority === undefined
      ? 'mid' : oneOf(body.priority, PRIORITIES, 'الأولوية');
    const branchId = optionalUuid(body.branchId, 'معرّف الفرع');

    const { rowCount } = await query(
      'SELECT 1 FROM customers WHERE id = $1 AND restaurant_id = $2', [customerId, rid]
    );
    if (!rowCount) throw notFound('العميل غير موجود.');

    const { rows } = await query(
      `INSERT INTO complaints (restaurant_id, branch_id, customer_id, summary, priority)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, summary, priority, status, created_at`,
      [rid, branchId, customerId, summary, priority]
    );
    await audit(req, {
      action: 'complaint.create', entityType: 'complaint', entityId: rows[0].id,
      payload: { customerId, priority },
    });
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = uuid(req.params.id, 'معرّف الشكوى');
    const body = req.body ?? {};
    const status = body.status === undefined ? null : oneOf(body.status, STATUSES, 'الحالة');
    const priority = body.priority === undefined ? null : oneOf(body.priority, PRIORITIES, 'الأولوية');

    const { rows } = await query(
      `UPDATE complaints
          SET status   = COALESCE($3, status),
              priority = COALESCE($4, priority),
              resolved_at = CASE
                WHEN COALESCE($3, status) = 'resolved' AND resolved_at IS NULL THEN now()
                WHEN COALESCE($3, status) <> 'resolved' THEN NULL
                ELSE resolved_at END
        WHERE id = $1 AND restaurant_id = $2
        RETURNING id, summary, priority, status, resolved_at`,
      [id, req.user.restaurantId, status, priority]
    );
    if (!rows[0]) throw notFound('الشكوى غير موجودة.');

    await audit(req, {
      action: 'complaint.update', entityType: 'complaint', entityId: id,
      payload: { status, priority },
    });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

export default router;
