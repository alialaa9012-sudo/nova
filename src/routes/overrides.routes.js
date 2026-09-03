import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { audit } from '../audit.js';
import { uuid, str, oneOf, notFound } from '../validate.js';

const router = Router();
router.use(requireAuth);

const CATEGORIES = ['stock_outage', 'price_change', 'closure', 'promo', 'general'];

/**
 * تعليمات طارئة للبوت — الحاجة اللي المطعم عايز البوت يقولها فورًا
 * (خلص صنف، الفرع مقفول النهاردة، عرض جديد...).
 */
router.get('/', async (req, res, next) => {
  try {
    const includeCancelled = req.query.all === 'true';
    const { rows } = await query(
      `SELECT id, category, text, added_by, active, created_at, cancelled_at
         FROM emergency_overrides
        WHERE restaurant_id = $1 AND ($2::boolean OR active)
        ORDER BY active DESC, created_at DESC
        LIMIT 200`,
      [req.user.restaurantId, includeCancelled]
    );
    res.json({ items: rows });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const category = oneOf(req.body?.category, CATEGORIES, 'النوع');
    const text = str(req.body?.text, 'نص التعليمات', { max: 4000 });
    const { rows } = await query(
      `INSERT INTO emergency_overrides (restaurant_id, category, text, added_by)
       VALUES ($1,$2,$3,$4)
       RETURNING id, category, text, added_by, active, created_at`,
      [req.user.restaurantId, category, text, req.user.email]
    );
    await audit(req, {
      action: 'emergency_override.create', entityType: 'emergency_override',
      entityId: rows[0].id, payload: { category },
    });
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

/** إلغاء تعليمة — مش حذف، عشان يفضل في السجل. */
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const id = uuid(req.params.id, 'معرّف التعليمة');
    const { rows } = await query(
      `UPDATE emergency_overrides SET active = false, cancelled_at = now()
        WHERE id = $1 AND restaurant_id = $2 AND active
        RETURNING id, category, active, cancelled_at`,
      [id, req.user.restaurantId]
    );
    if (!rows[0]) throw notFound('التعليمة غير موجودة أو ملغاة بالفعل.');
    await audit(req, {
      action: 'emergency_override.cancel', entityType: 'emergency_override', entityId: id,
    });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

export default router;
