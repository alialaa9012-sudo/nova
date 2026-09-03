import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { audit } from '../audit.js';
import {
  uuid, optionalUuid, str, optionalStr, oneOf, optionalOneOf,
  pageLimit, pageOffset, notFound,
} from '../validate.js';

const router = Router();
router.use(requireAuth);

const CLASSIFICATIONS = ['new', 'repeat', 'vip'];

router.get('/', async (req, res, next) => {
  try {
    const search = optionalStr(req.query.search, 'البحث', { max: 100 });
    const classification = optionalOneOf(req.query.classification, CLASSIFICATIONS, 'التصنيف');
    const limit = pageLimit(req.query.limit);
    const offset = pageOffset(req.query.offset);

    const { rows } = await query(
      `SELECT c.id, c.phone, c.name, c.classification, c.favorite_item,
              c.visit_count, c.last_visit_at, c.created_at,
              b.name AS preferred_branch_name,
              (SELECT count(*) FROM reservations r WHERE r.customer_id = c.id) AS reservations_count,
              (SELECT count(*) FROM complaints  x WHERE x.customer_id = c.id) AS complaints_count,
              count(*) OVER () AS total_count
         FROM customers c
         LEFT JOIN branches b ON b.id = c.preferred_branch_id
        WHERE c.restaurant_id = $1
          AND c.deleted_at IS NULL
          AND ($2::text IS NULL OR c.name ILIKE '%' || $2 || '%' OR c.phone ILIKE '%' || $2 || '%')
          AND ($3::text IS NULL OR c.classification = $3)
        ORDER BY c.last_visit_at DESC NULLS LAST, c.created_at DESC
        LIMIT $4 OFFSET $5`,
      [req.user.restaurantId, search, classification, limit, offset]
    );

    res.json({
      total: rows[0]?.total_count ?? 0,
      items: rows.map(({ total_count, ...r }) => r),
    });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const phone = str(body.phone, 'رقم التليفون', { max: 32 });
    const name = optionalStr(body.name, 'الاسم', { max: 200 });
    const classification = body.classification === undefined
      ? 'new' : oneOf(body.classification, CLASSIFICATIONS, 'التصنيف');
    const preferredBranchId = optionalUuid(body.preferredBranchId, 'الفرع المفضّل');

    const { rows } = await query(
      `INSERT INTO customers (restaurant_id, phone, name, classification, preferred_branch_id)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (restaurant_id, phone) DO UPDATE
         SET name = COALESCE(EXCLUDED.name, customers.name),
             classification = EXCLUDED.classification,
             deleted_at = NULL
       RETURNING id, phone, name, classification, visit_count, created_at`,
      [req.user.restaurantId, phone, name, classification, preferredBranchId]
    );
    await audit(req, {
      action: 'customer.create', entityType: 'customer', entityId: rows[0].id,
      payload: { phone, classification },
    });
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = uuid(req.params.id, 'معرّف العميل');
    const body = req.body ?? {};
    const name = body.name === undefined ? null : optionalStr(body.name, 'الاسم', { max: 200 });
    const classification = body.classification === undefined
      ? null : oneOf(body.classification, CLASSIFICATIONS, 'التصنيف');
    const favoriteItem = body.favoriteItem === undefined
      ? undefined : optionalStr(body.favoriteItem, 'الصنف المفضّل', { max: 200 });

    const { rows } = await query(
      `UPDATE customers
          SET name = COALESCE($3, name),
              classification = COALESCE($4, classification),
              favorite_item = CASE WHEN $5::boolean THEN $6::text ELSE favorite_item END
        WHERE id = $1 AND restaurant_id = $2 AND deleted_at IS NULL
        RETURNING id, phone, name, classification, favorite_item, visit_count`,
      [id, req.user.restaurantId, name, classification,
       favoriteItem !== undefined, favoriteItem ?? null]
    );
    if (!rows[0]) throw notFound('العميل غير موجود.');
    await audit(req, {
      action: 'customer.update', entityType: 'customer', entityId: id,
      payload: { name, classification },
    });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

/** حذف ناعم — الحجوزات والشكاوى المرتبطة تفضل موجودة. */
router.delete('/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const id = uuid(req.params.id, 'معرّف العميل');
    const { rows } = await query(
      `UPDATE customers SET deleted_at = now()
        WHERE id = $1 AND restaurant_id = $2 AND deleted_at IS NULL
        RETURNING id, phone`,
      [id, req.user.restaurantId]
    );
    if (!rows[0]) throw notFound('العميل غير موجود.');
    await audit(req, {
      action: 'customer.delete', entityType: 'customer', entityId: id,
      payload: { phone: rows[0].phone },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
