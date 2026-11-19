-- The closing status «تم التسليم»: the customer has the order. Kept in its own migration because a
-- new enum value can only be used once the statement that adds it has committed.
alter type public.order_status add value if not exists 'delivered' after 'out_for_delivery';
