import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { audit } from '../audit.js';
import {
  uuid, optionalUuid, str, optionalOneOf, money, int, bool, notFound,
} from '../validate.js';

const router = Router();
router.use(requireAuth);

const UNAVAILABLE_REASONS = ['kitchen', 'staff', 'seasonal'];
const VARIANT_TYPES = ['size', 'addon'];

/** المنيو كامل: أقسام + أصناف + أحجام/إضافات. */
router.get('/', async (req, res, next) => {
  try {
    const rid = req.user.restaurantId;
    const { rows } = await query(
      `SELECT c.id AS category_id, c.name AS category_name, c.sort_order,
              i.id, i.name, i.price, i.available, i.unavailable_reason,
              i.available_again_at, i.updated_at,
              COALESCE(v.variants, '[]'::json) AS variants
         FROM menu_categories c
         LEFT JOIN menu_items i ON i.category_id = c.id AND i.restaurant_id = $1
         LEFT JOIN LATERAL (
           SELECT json_agg(json_build_object(
                    'id', mv.id, 'label', mv.label, 'variant_type', mv.variant_type,
                    'price', mv.price, 'sort_order', mv.sort_order)
                  ORDER BY mv.sort_order, mv.label) AS variants
             FROM menu_item_variants mv WHERE mv.item_id = i.id
         ) v ON true
        WHERE c.restaurant_id = $1
        ORDER BY c.sort_order, c.name, i.name`,
      [rid]
    );

    // أصناف بدون قسم
    const { rows: orphans } = await query(
      `SELECT i.id, i.name, i.price, i.available, i.unavailable_reason,
              i.available_again_at, i.updated_at,
              COALESCE(v.variants, '[]'::json) AS variants
         FROM menu_items i
         LEFT JOIN LATERAL (
           SELECT json_agg(json_build_object(
                    'id', mv.id, 'label', mv.label, 'variant_type', mv.variant_type,
                    'price', mv.price, 'sort_order', mv.sort_order)
                  ORDER BY mv.sort_order, mv.label) AS variants
             FROM menu_item_variants mv WHERE mv.item_id = i.id
         ) v ON true
        WHERE i.restaurant_id = $1 AND i.category_id IS NULL
        ORDER BY i.name`,
      [rid]
    );

    const byCategory = new Map();
    for (const r of rows) {
      if (!byCategory.has(r.category_id)) {
        byCategory.set(r.category_id, {
          id: r.category_id, name: r.category_name, sortOrder: r.sort_order, items: [],
        });
      }
      if (r.id) {
        byCategory.get(r.category_id).items.push({
          id: r.id, name: r.name, price: r.price, available: r.available,
          unavailableReason: r.unavailable_reason, availableAgainAt: r.available_again_at,
          updatedAt: r.updated_at, variants: r.variants,
        });
      }
    }

    const categories = [...byCategory.values()];
    if (orphans.length) {
      categories.push({
        id: null, name: 'بدون قسم', sortOrder: 9999,
        items: orphans.map((r) => ({
          id: r.id, name: r.name, price: r.price, available: r.available,
          unavailableReason: r.unavailable_reason, availableAgainAt: r.available_again_at,
          updatedAt: r.updated_at, variants: r.variants,
        })),
      });
    }

    res.json({ categories });
  } catch (err) { next(err); }
});

// ---------- الأقسام ----------

router.post('/categories', requireRole('manager'), async (req, res, next) => {
  try {
    const name = str(req.body?.name, 'اسم القسم', { max: 120 });
    const sortOrder = req.body?.sortOrder === undefined ? 0 : int(req.body.sortOrder, 'الترتيب');
    const { rows } = await query(
      `INSERT INTO menu_categories (restaurant_id, name, sort_order)
       VALUES ($1, $2, $3) RETURNING id, name, sort_order`,
      [req.user.restaurantId, name, sortOrder]
    );
    await audit(req, {
      action: 'menu_category.create', entityType: 'menu_category',
      entityId: rows[0].id, payload: { name, sortOrder },
    });
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/categories/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const id = uuid(req.params.id, 'معرّف القسم');
    const name = str(req.body?.name, 'اسم القسم', { max: 120 });
    const sortOrder = req.body?.sortOrder === undefined ? null : int(req.body.sortOrder, 'الترتيب');
    const { rows } = await query(
      `UPDATE menu_categories
          SET name = $3, sort_order = COALESCE($4, sort_order)
        WHERE id = $1 AND restaurant_id = $2
        RETURNING id, name, sort_order`,
      [id, req.user.restaurantId, name, sortOrder]
    );
    if (!rows[0]) throw notFound('القسم غير موجود.');
    await audit(req, {
      action: 'menu_category.update', entityType: 'menu_category', entityId: id,
      payload: { name, sortOrder },
    });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/categories/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const id = uuid(req.params.id, 'معرّف القسم');
    const rid = req.user.restaurantId;
    const result = await withTransaction(async (client) => {
      // فك ارتباط الأصناف بدل حذفها — الأصناف أغلى من القسم.
      await client.query(
        `UPDATE menu_items SET category_id = NULL, updated_at = now()
          WHERE category_id = $1 AND restaurant_id = $2`,
        [id, rid]
      );
      const { rows } = await client.query(
        'DELETE FROM menu_categories WHERE id = $1 AND restaurant_id = $2 RETURNING id, name',
        [id, rid]
      );
      return rows[0];
    });
    if (!result) throw notFound('القسم غير موجود.');
    await audit(req, {
      action: 'menu_category.delete', entityType: 'menu_category', entityId: id,
      payload: { name: result.name },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---------- الأصناف ----------

router.post('/items', requireRole('manager'), async (req, res, next) => {
  try {
    const name = str(req.body?.name, 'اسم الصنف', { max: 200 });
    const price = money(req.body?.price, 'السعر');
    const categoryId = optionalUuid(req.body?.categoryId, 'معرّف القسم');
    const rid = req.user.restaurantId;

    if (categoryId) await assertCategory(categoryId, rid);

    const { rows } = await query(
      `INSERT INTO menu_items (restaurant_id, category_id, name, price)
       VALUES ($1, $2, $3, $4)
       RETURNING id, category_id, name, price, available, updated_at`,
      [rid, categoryId, name, price]
    );
    await audit(req, {
      action: 'menu_item.create', entityType: 'menu_item', entityId: rows[0].id,
      payload: { name, price, categoryId },
    });
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/items/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const id = uuid(req.params.id, 'معرّف الصنف');
    const rid = req.user.restaurantId;
    const body = req.body ?? {};

    const name = body.name === undefined ? null : str(body.name, 'اسم الصنف', { max: 200 });
    const price = body.price === undefined ? null : money(body.price, 'السعر');
    const categoryId = body.categoryId === undefined
      ? undefined
      : optionalUuid(body.categoryId, 'معرّف القسم');

    if (categoryId) await assertCategory(categoryId, rid);

    const { rows } = await query(
      `UPDATE menu_items
          SET name        = COALESCE($3, name),
              price       = COALESCE($4, price),
              category_id = CASE WHEN $5::boolean THEN $6::uuid ELSE category_id END,
              updated_at  = now()
        WHERE id = $1 AND restaurant_id = $2
        RETURNING id, category_id, name, price, available, unavailable_reason,
                  available_again_at, updated_at`,
      [id, rid, name, price, categoryId !== undefined, categoryId ?? null]
    );
    if (!rows[0]) throw notFound('الصنف غير موجود.');
    await audit(req, {
      action: 'menu_item.update', entityType: 'menu_item', entityId: id,
      payload: { name, price, categoryId },
    });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

/** تشغيل/إيقاف صنف — أكثر عملية يومية في المطعم. */
router.patch('/items/:id/availability', async (req, res, next) => {
  try {
    const id = uuid(req.params.id, 'معرّف الصنف');
    const available = bool(req.body?.available, 'حالة التوفر');
    const reason = available
      ? null
      : optionalOneOf(req.body?.reason, UNAVAILABLE_REASONS, 'سبب عدم التوفر');
    const againAt = available || !req.body?.availableAgainAt
      ? null
      : new Date(req.body.availableAgainAt).toISOString();

    const { rows } = await query(
      `UPDATE menu_items
          SET available = $3,
              unavailable_reason = $4,
              available_again_at = $5,
              updated_at = now()
        WHERE id = $1 AND restaurant_id = $2
        RETURNING id, name, available, unavailable_reason, available_again_at`,
      [id, req.user.restaurantId, available, reason, againAt]
    );
    if (!rows[0]) throw notFound('الصنف غير موجود.');
    await audit(req, {
      action: available ? 'menu_item.enable' : 'menu_item.disable',
      entityType: 'menu_item', entityId: id,
      payload: { available, reason, availableAgainAt: againAt },
    });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/items/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const id = uuid(req.params.id, 'معرّف الصنف');
    const { rows } = await query(
      'DELETE FROM menu_items WHERE id = $1 AND restaurant_id = $2 RETURNING id, name',
      [id, req.user.restaurantId]
    );
    if (!rows[0]) throw notFound('الصنف غير موجود.');
    await audit(req, {
      action: 'menu_item.delete', entityType: 'menu_item', entityId: id,
      payload: { name: rows[0].name },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---------- الأحجام والإضافات ----------

router.post('/items/:id/variants', requireRole('manager'), async (req, res, next) => {
  try {
    const itemId = uuid(req.params.id, 'معرّف الصنف');
    await assertItem(itemId, req.user.restaurantId);

    const label = str(req.body?.label, 'اسم الحجم/الإضافة', { max: 120 });
    const variantType = req.body?.variantType === undefined
      ? 'size'
      : optionalOneOf(req.body.variantType, VARIANT_TYPES, 'النوع') ?? 'size';
    const price = money(req.body?.price, 'السعر');
    const sortOrder = req.body?.sortOrder === undefined ? 0 : int(req.body.sortOrder, 'الترتيب');

    const { rows } = await query(
      `INSERT INTO menu_item_variants (item_id, label, variant_type, price, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, item_id, label, variant_type, price, sort_order`,
      [itemId, label, variantType, price, sortOrder]
    );
    await audit(req, {
      action: 'menu_item_variant.create', entityType: 'menu_item_variant',
      entityId: rows[0].id, payload: { itemId, label, variantType, price },
    });
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/variants/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const id = uuid(req.params.id, 'معرّف الحجم/الإضافة');
    const { rows } = await query(
      `DELETE FROM menu_item_variants v
        USING menu_items i
        WHERE v.id = $1 AND v.item_id = i.id AND i.restaurant_id = $2
        RETURNING v.id, v.label`,
      [id, req.user.restaurantId]
    );
    if (!rows[0]) throw notFound('الحجم/الإضافة غير موجود.');
    await audit(req, {
      action: 'menu_item_variant.delete', entityType: 'menu_item_variant', entityId: id,
      payload: { label: rows[0].label },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

async function assertCategory(categoryId, restaurantId) {
  const { rowCount } = await query(
    'SELECT 1 FROM menu_categories WHERE id = $1 AND restaurant_id = $2',
    [categoryId, restaurantId]
  );
  if (!rowCount) throw notFound('القسم غير موجود.');
}

async function assertItem(itemId, restaurantId) {
  const { rowCount } = await query(
    'SELECT 1 FROM menu_items WHERE id = $1 AND restaurant_id = $2',
    [itemId, restaurantId]
  );
  if (!rowCount) throw notFound('الصنف غير موجود.');
}

export default router;
