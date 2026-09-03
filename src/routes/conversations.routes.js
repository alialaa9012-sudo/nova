import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAuth } from '../auth.js';
import { audit } from '../audit.js';
import {
  uuid, str, optionalOneOf, pageLimit, pageOffset, notFound,
} from '../validate.js';

const router = Router();
router.use(requireAuth);

const STATUSES = ['ai', 'human', 'closed'];

router.get('/', async (req, res, next) => {
  try {
    const status = optionalOneOf(req.query.status, STATUSES, 'الحالة');
    const limit = pageLimit(req.query.limit);
    const offset = pageOffset(req.query.offset);

    const { rows } = await query(
      `SELECT cv.id, cv.channel, cv.status, cv.assigned_to, cv.escalation_reason,
              cv.last_message_at, cv.created_at,
              c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone,
              c.classification AS customer_classification,
              (SELECT count(*) FROM messages m WHERE m.conversation_id = cv.id) AS messages_count,
              (SELECT m.body FROM messages m WHERE m.conversation_id = cv.id
                ORDER BY m.created_at DESC LIMIT 1) AS last_message,
              count(*) OVER () AS total_count
         FROM conversations cv
         JOIN customers c ON c.id = cv.customer_id
        WHERE cv.restaurant_id = $1
          AND ($2::text IS NULL OR cv.status = $2)
        ORDER BY cv.last_message_at DESC
        LIMIT $3 OFFSET $4`,
      [req.user.restaurantId, status, limit, offset]
    );

    res.json({
      total: rows[0]?.total_count ?? 0,
      items: rows.map(({ total_count, ...r }) => r),
    });
  } catch (err) { next(err); }
});

router.get('/:id/messages', async (req, res, next) => {
  try {
    const id = uuid(req.params.id, 'معرّف المحادثة');
    await assertConversation(id, req.user.restaurantId);

    const { rows } = await query(
      `SELECT id, direction, sender, message_type, body, media_url,
              intent_type, created_at
         FROM messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC
        LIMIT 500`,
      [id]
    );
    res.json({ items: rows });
  } catch (err) { next(err); }
});

/** استلام المحادثة من البوت — الموظف يرد بنفسه. */
router.post('/:id/takeover', async (req, res, next) => {
  try {
    const id = uuid(req.params.id, 'معرّف المحادثة');
    const { rows } = await query(
      `UPDATE conversations
          SET status = 'human', assigned_to = $3
        WHERE id = $1 AND restaurant_id = $2 AND status <> 'closed'
        RETURNING id, status, assigned_to`,
      [id, req.user.restaurantId, req.user.email]
    );
    if (!rows[0]) throw notFound('المحادثة غير موجودة أو مقفولة.');
    await audit(req, { action: 'conversation.takeover', entityType: 'conversation', entityId: id });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

/** رجوع المحادثة للبوت. */
router.post('/:id/handback', async (req, res, next) => {
  try {
    const id = uuid(req.params.id, 'معرّف المحادثة');
    const { rows } = await query(
      `UPDATE conversations
          SET status = 'ai', assigned_to = NULL, escalation_reason = NULL
        WHERE id = $1 AND restaurant_id = $2 AND status = 'human'
        RETURNING id, status`,
      [id, req.user.restaurantId]
    );
    if (!rows[0]) throw notFound('المحادثة غير موجودة أو مش مستلمة من موظف.');
    await audit(req, {
      action: 'conversation.handback_to_ai', entityType: 'conversation', entityId: id,
    });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post('/:id/close', async (req, res, next) => {
  try {
    const id = uuid(req.params.id, 'معرّف المحادثة');
    const { rows } = await query(
      `UPDATE conversations SET status = 'closed'
        WHERE id = $1 AND restaurant_id = $2 AND status <> 'closed'
        RETURNING id, status`,
      [id, req.user.restaurantId]
    );
    if (!rows[0]) throw notFound('المحادثة غير موجودة أو مقفولة بالفعل.');
    await audit(req, { action: 'conversation.close', entityType: 'conversation', entityId: id });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

/**
 * تسجيل رد الموظف داخل المحادثة.
 * ملاحظة: ده بيسجّل الرسالة في قاعدة البيانات فقط.
 * الإرسال الفعلي على واتساب يتم من خدمة الواتساب (WhatsApp Cloud API) لما تتوصّل.
 */
router.post('/:id/messages', async (req, res, next) => {
  try {
    const id = uuid(req.params.id, 'معرّف المحادثة');
    const body = str(req.body?.body, 'نص الرسالة', { max: 4000 });
    const rid = req.user.restaurantId;

    await assertConversation(id, rid);

    const row = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO messages (conversation_id, direction, sender, message_type, body)
         VALUES ($1, 'outbound', 'staff', 'text', $2)
         RETURNING id, direction, sender, body, created_at`,
        [id, body]
      );
      await client.query(
        `UPDATE conversations
            SET last_message_at = now(),
                status = CASE WHEN status = 'ai' THEN 'human' ELSE status END,
                assigned_to = COALESCE(assigned_to, $2)
          WHERE id = $1`,
        [id, req.user.email]
      );
      return rows[0];
    });

    await audit(req, {
      action: 'conversation.staff_reply', entityType: 'conversation', entityId: id,
      payload: { messageId: row.id },
    });
    res.status(201).json(row);
  } catch (err) { next(err); }
});

async function assertConversation(id, restaurantId) {
  const { rowCount } = await query(
    'SELECT 1 FROM conversations WHERE id = $1 AND restaurant_id = $2',
    [id, restaurantId]
  );
  if (!rowCount) throw notFound('المحادثة غير موجودة.');
}

export default router;
