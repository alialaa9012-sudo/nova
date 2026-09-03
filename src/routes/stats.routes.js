import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

/** أرقام لوحة التحكم الرئيسية. */
router.get('/', async (req, res, next) => {
  try {
    const rid = req.user.restaurantId;
    const { rows } = await query(
      `WITH r AS (SELECT id, timezone FROM restaurants WHERE id = $1)
       SELECT
         (SELECT count(*) FROM reservations res, r
            WHERE res.restaurant_id = r.id
              AND (res.reservation_time AT TIME ZONE r.timezone)::date
                = (now() AT TIME ZONE r.timezone)::date)            AS reservations_today,
         (SELECT count(*) FROM reservations res, r
            WHERE res.restaurant_id = r.id AND res.status = 'pending'
              AND res.reservation_time >= now())                     AS reservations_pending,
         (SELECT count(*) FROM reservations res, r
            WHERE res.restaurant_id = r.id AND res.status = 'confirmed'
              AND res.reservation_time >= now())                     AS reservations_upcoming,
         (SELECT count(*) FROM complaints c, r
            WHERE c.restaurant_id = r.id AND c.status <> 'resolved')  AS complaints_open,
         (SELECT count(*) FROM complaints c, r
            WHERE c.restaurant_id = r.id AND c.status <> 'resolved'
              AND c.priority = 'high')                               AS complaints_high,
         (SELECT count(*) FROM conversations cv, r
            WHERE cv.restaurant_id = r.id AND cv.status = 'human')    AS conversations_human,
         (SELECT count(*) FROM conversations cv, r
            WHERE cv.restaurant_id = r.id AND cv.status = 'ai')       AS conversations_ai,
         (SELECT count(*) FROM menu_items m, r
            WHERE m.restaurant_id = r.id)                             AS menu_items_total,
         (SELECT count(*) FROM menu_items m, r
            WHERE m.restaurant_id = r.id AND NOT m.available)         AS menu_items_unavailable,
         (SELECT count(*) FROM customers cu, r
            WHERE cu.restaurant_id = r.id AND cu.deleted_at IS NULL)  AS customers_total,
         (SELECT count(*) FROM customers cu, r
            WHERE cu.restaurant_id = r.id AND cu.deleted_at IS NULL
              AND cu.classification = 'vip')                          AS customers_vip,
         (SELECT count(*) FROM emergency_overrides e, r
            WHERE e.restaurant_id = r.id AND e.active)                AS overrides_active,
         (SELECT coalesce(sum(cost_usd), 0) FROM daily_costs d, r
            WHERE d.restaurant_id = r.id
              AND d.day = (now() AT TIME ZONE r.timezone)::date)      AS ai_cost_today`,
      [rid]
    );
    res.json(rows[0] ?? {});
  } catch (err) { next(err); }
});

/** حجوزات آخر 14 يوم — للرسم البياني. */
router.get('/reservations-trend', async (req, res, next) => {
  try {
    const { rows } = await query(
      `WITH r AS (SELECT id, timezone FROM restaurants WHERE id = $1),
       days AS (
         SELECT generate_series(
           (now() AT TIME ZONE (SELECT timezone FROM r))::date - INTERVAL '13 days',
           (now() AT TIME ZONE (SELECT timezone FROM r))::date,
           INTERVAL '1 day')::date AS day
       )
       SELECT days.day,
              count(res.id) FILTER (WHERE res.status <> 'cancelled') AS total,
              count(res.id) FILTER (WHERE res.status = 'confirmed')  AS confirmed
         FROM days
         LEFT JOIN reservations res
           ON res.restaurant_id = (SELECT id FROM r)
          AND (res.reservation_time AT TIME ZONE (SELECT timezone FROM r))::date = days.day
        GROUP BY days.day
        ORDER BY days.day`,
      [req.user.restaurantId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
