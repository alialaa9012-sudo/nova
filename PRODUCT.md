# Product

<!-- impeccable:product-schema 1 -->

Scope: the ordering app in `app/`. The static pages at the repository root (`index.html`, `privacy.html`, `terms.html`) belong to a different product (NOVA) and are out of scope.

## Platform

web

## Users
- **Customers of «خليها مشاوي»** in العاشر من رمضان, الزقازيق and التجمع الخامس, ordering grilled food for delivery or pickup, mostly on Android phones over mobile data, in Arabic. No account, cash only.
- **Call-center agents** taking and moving many orders during service hours on a desktop browser, then keying each order into the Crystal Mind POS by hand.
- **The owner/admin**, who maintains delivery zones and prices and reviews orders per branch.

## Product Purpose
The restaurant's own ordering channel: a customer picks a branch, orders from that branch's real menu and prices, and gets an order number they can track; the call center receives every order on one board and moves it through four statuses. Success: orders arrive complete (items, zone, address, phone) so the call center needs fewer calls to clarify them.

## Positioning
A direct channel owned by the restaurant, not a marketplace: each branch's own printed menu and prices, delivery fees per branch zone, no commission, no customer account.

## Operating Context
- Three branches, each with its own menu file, prices, delivery zones, phones and hours (Cairo time; Thursday and Friday close at 01:00).
- Branch hours gate ordering: a closed branch lets customers prepare a cart but not confirm it.
- Orders are entered manually into Crystal Mind (desktop POS per branch); the board gives copy-ready order text and a POS invoice field.
- Demo mode today: orders, added zones and checkout drafts live in the browser only, until Supabase, Cloudflare and Telegram are connected.
- The call-center board lists work queues oldest first and colours an order's wait time (warning from 10 minutes, urgent from 20; adjustable defaults).

## Capabilities and Constraints
- Order statuses are exactly four: «طلب جديد», «تم استلام طلبك وجاري التجهيز», «خرج للتوصيل» (shown as «جاهز للاستلام» for pickup), «ملغي». Cancelling requires a reason.
- Order numbers: branch letter + daily counter (A-0001, Z-0001, T-0001).
- Prices are recomputed on the server; online service charge is 0; 14% tax applies at التجمع الخامس only (on items).
- Sizes are the printed ones (ربع/تلت/نص/كيلو); booking-only items (24 h) are phoned in, not ordered online.
- No discounts, coupons, ratings, favourites, accounts or online payment.
- Routes, Arabic copy, storage keys and pricing rules must not change in visual work.
- Checkout keeps an on-device draft (`km.checkoutDraft.v1.<branch>`), cleared once the order is placed.

## Brand Commitments
- Name «خليها مشاوي» / Khaliha Mashawy; Arabic first, right-to-left.
- Logos supplied by the owner: `app/public/brand/logo.png` (transparent, light backgrounds) and `app/public/brand/logo-dark.jpg` (dark backgrounds only).
- Owner-approved redesign brief (14 Nov 2026): warm light identity with an orange-red brand colour, Cairo typeface.
- WhatsApp 01061005627 for all branches.

## Evidence on Hand
- Real menus and delivery-zone lists per branch in `app/data/` (from the owner's files).
- No item photos yet: the owner adds them to `app/menu-images/` by item name. Placeholders until then.
- No offers, badges, testimonials or reviews exist; the home banner, menu offer strip and item badges stay hidden until the owner supplies real content. Never fabricate them.

## Product Principles
1. Get a correct order in as few steps as possible; never lose what the customer already chose.
2. Every price and fee the customer sees is the one the restaurant charges.
3. Show the real state of the branch (open, closed, paused) before the customer invests effort.
4. The call-center board favours speed and scanning over decoration.

## Accessibility & Inclusion
- Arabic RTL throughout; Arabic and Latin digits accepted in phone and order-number fields.
- WCAG 2.2 AA is the bar; touch targets sized for one-handed phone use; automated axe scans on every screen.
