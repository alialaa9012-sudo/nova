import { query } from './db.js';

/**
 * تسجيل كل عملية كتابة في audit_log.
 * لا يجب أن يفشل الطلب الأساسي لو فشل التسجيل.
 */
export async function audit(req, { action, entityType = null, entityId = null, payload = null }) {
  try {
    await query(
      `INSERT INTO audit_log (restaurant_id, actor, action, entity_type, entity_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.restaurantId ?? null,
        req.user?.email ?? 'system',
        action,
        entityType,
        entityId,
        payload ? JSON.stringify(payload) : null,
      ]
    );
  } catch (err) {
    console.error('[audit] failed:', action, err.message);
  }
}
