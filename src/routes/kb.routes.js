import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { audit } from '../audit.js';
import { uuid, str, notFound } from '../validate.js';

const router = Router();
router.use(requireAuth);

/** قاعدة معرفة البوت: الأسئلة الشائعة وإجاباتها. */
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, topic, content, updated_at
         FROM kb_entries WHERE restaurant_id = $1 ORDER BY topic`,
      [req.user.restaurantId]
    );
    res.json({ items: rows });
  } catch (err) { next(err); }
});

router.post('/', requireRole('manager'), async (req, res, next) => {
  try {
    const topic = str(req.body?.topic, 'الموضوع', { max: 200 });
    const content = str(req.body?.content, 'المحتوى', { max: 8000 });
    const { rows } = await query(
      `INSERT INTO kb_entries (restaurant_id, topic, content)
       VALUES ($1,$2,$3) RETURNING id, topic, content, updated_at`,
      [req.user.restaurantId, topic, content]
    );
    await audit(req, {
      action: 'kb.create', entityType: 'kb_entry', entityId: rows[0].id, payload: { topic },
    });
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const id = uuid(req.params.id, 'معرّف المدخل');
    const topic = str(req.body?.topic, 'الموضوع', { max: 200 });
    const content = str(req.body?.content, 'المحتوى', { max: 8000 });
    const { rows } = await query(
      `UPDATE kb_entries SET topic = $3, content = $4, updated_at = now()
        WHERE id = $1 AND restaurant_id = $2
        RETURNING id, topic, content, updated_at`,
      [id, req.user.restaurantId, topic, content]
    );
    if (!rows[0]) throw notFound('المدخل غير موجود.');
    await audit(req, { action: 'kb.update', entityType: 'kb_entry', entityId: id, payload: { topic } });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const id = uuid(req.params.id, 'معرّف المدخل');
    const { rows } = await query(
      'DELETE FROM kb_entries WHERE id = $1 AND restaurant_id = $2 RETURNING id, topic',
      [id, req.user.restaurantId]
    );
    if (!rows[0]) throw notFound('المدخل غير موجود.');
    await audit(req, {
      action: 'kb.delete', entityType: 'kb_entry', entityId: id, payload: { topic: rows[0].topic },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
