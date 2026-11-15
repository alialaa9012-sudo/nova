---
name: خليها مشاوي — Ordering app
description: Warm, light Arabic RTL ordering app for an Egyptian grill house; orange-red for every action, the logo's muted gold for frames.
colors:
  page: "#fceddf"
  card: "#fef9f5"
  surface: "#ffffff"
  control: "#fdf5ec"
  chip-idle: "#f5f5f5"
  nav: "#fefcfa"
  ink: "#1a1511"
  ink-muted: "#6b6560"
  ember: "#d93a0b"
  ember-pressed: "#c2350b"
  ember-text: "#b8330a"
  peach-soft: "#fcc494"
  peach-tint: "#fbe6d1"
  logo-gold: "#b09878"
  logo-gold-deep: "#8a7150"
  line: "#938679"
  success: "#1f6b45"
  success-soft: "#ddf1e3"
  success-ink: "#1c5b3a"
  warning-soft: "#fbefc9"
  warning-ink: "#4a2c06"
  danger: "#b42318"
  danger-soft: "#fde9e5"
  danger-ink: "#8f1d13"
  closed-soft: "#ece2d6"
  closed-ink: "#3d3127"
typography:
  page-title:
    fontFamily: "Cairo Variable, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: "36px"
  section-title:
    fontFamily: "Cairo Variable, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: "26px"
  item-name:
    fontFamily: "Cairo Variable, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: "22px"
  price:
    fontFamily: "Cairo Variable, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 800
    lineHeight: "22px"
  body:
    fontFamily: "Cairo Variable, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
  small:
    fontFamily: "Cairo Variable, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "18px"
  order-number:
    fontFamily: "Cairo Variable, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: "40px"
rounded:
  field: "16px"
  card: "20px"
  sheet: "28px"
  pill: "9999px"
  arch: "96px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    height: "52px"
  button-primary-pressed:
    backgroundColor: "{colors.ember-pressed}"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "44px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    height: "52px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "16px"
  chip-category:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "40px"
  chip-category-active:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.surface}"
  chip-status-filter-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
  size-chip-selected:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.surface}"
    rounded: "{rounded.field}"
    height: "56px"
  header-button:
    backgroundColor: "{colors.control}"
    rounded: "{rounded.field}"
    size: "44px"
---

# Design System: خليها مشاوي

## Overview
A task app, not a landing page: customers pick a branch, order and track; call-center agents work a queue. The look is the owner-approved warm light identity (spec of 14 Nov 2026): a peach page, near-white cards lifted by soft brown-tinted shadows instead of borders, one orange-red for every action, and Cairo for all text. What makes it the restaurant's own is borrowed from the logo: its muted gold and its arched frame, used sparingly as frames and hairlines. Right-to-left throughout; numbers and phone numbers sit in left-to-right islands.

## Colors
### Primary
- **Ember** `#d93a0b`: every customer action (primary buttons, «+», active category chip, selected size, brand marks). Measured from the reference `#dd3d0e` and darkened so white text reaches 4.6:1. Pressed `#c2350b`. On light backgrounds, ember text uses `#b8330a` (5.2:1).
- **Peach tint / soft** `#fbe6d1` / `#fcc494`: selected surfaces, separators inside cards, text selection.

### Secondary
- **Logo gold** `#b09878` (measured from `public/brand/logo.png`): frames and hairlines only (order-number arch, active-order strip, photo placeholder). Never text; for small marks that must stay visible use `#8a7150`.

### Neutral
- Page `#fceddf`, card `#fef9f5`, field `#ffffff`, control `#fdf5ec`, idle chip `#f5f5f5`.
- Ink `#1a1511` (15.8:1 on the page); muted ink `#6b6560` (5.0:1 on the page, 5.5:1 on cards).
- Line `#938679` for field borders and outlined controls (3.4:1, WCAG 1.4.11).

### Named Rules
- **States are warm, never stock:** success `#1f6b45`/`#ddf1e3`, warning `#4a2c06` on `#fbefc9`, danger `#b42318`/`#fde9e5`, closed `#3d3127` on `#ece2d6`. No Tailwind greens, ambers or stones in components.
- **Staff selection is dark:** selected status filters on the board use ink, so staff controls never look like customer actions.
- **Green means done:** completed status steps stay success green; ember is never used for "done".

## Typography
One family, Cairo (variable, self-hosted), with real fallbacks. Arabic sizes run a step larger than Latin equivalents.

### Hierarchy
| Role | Size / line | Weight |
|---|---|---|
| Page title | 26 / 36 | 800 |
| Section title, sheet title | 18 / 26, 20 / 28 | 700 |
| Item name | 15 / 22 | 700 |
| Price, totals | 16 / 22, total 18 / 26 | 800 |
| Body, fields | 16 / 24 | 400 |
| Description, hints | 12–13 / 18–20 | 400 |
| Order number | 40 | 800, tabular |

### Named Rules
- Nothing a customer must read is under 12px.
- Prices and totals use tabular numerals; headings balance, paragraphs use `text-wrap: pretty` (no lone last word).

## Layout
- Side gutter 20px (24px from 768px). Containers: 1200px for customer pages, 1280px for the board, 768px for forms, 1100px for checkout on desktop.
- Menu: sections without photos are rows (1/2/3 columns at <640/≥640/≥1024px); sections with photos are 4:3 photo cards (2/3/4 columns).
- Checkout: one column with a fixed confirm bar on phones; from 1024px two columns with the summary and confirm button kept in view.
- Board: one filter panel, then order cards in 1/2/3 columns (≥1024/≥1440px).
- Phones get a floating bottom navigation on home and tracking; from 1024px its links move to the header.

## Elevation & Depth
### Shadow Vocabulary
- **Card:** 0 4px 16px rgb(74 38 14 / 8%) — cards, header buttons, secondary buttons.
- **Floating:** 0 8px 24px rgb(74 38 14 / 14%) — bottom navigation, sheets, dropdown lists.
- **Call to action:** 0 6px 16px rgb(217 58 11 / 30%) — the cart pill and confirm buttons.

### Named Rules
- Separation comes from shadow and radius, not borders; borders are for fields (line colour) and gold frames.

## Shapes
Fields and header buttons 16px; cards 20px; sheets and dialogs 28px (top corners only on phones); buttons, chips and badges fully round. The arch (96px top corners) is reserved for the order-number frame and the photo placeholder.

## Components
### Buttons
Primary: ember pill, 52px (44px in dense rows), white bold 15px, disabled at 45% opacity. Secondary: card pill with the card shadow. Destructive: danger text or a danger pill for confirmations.

### Chips
Category chips 40px pill, card background, active ember. Size chips 56px tall, 16px radius, name over price, selected ember. Status filter chips on the board: control background, active ink.

### Cards / Containers
Card `#fef9f5`, 20px, card shadow, 16px padding. Menu rows are cards; the whole row opens the item. Order cards on the board carry the items, notes, a wait-time chip and an aligned action row.

### Inputs / Fields
52px, 16px radius, white, line border; focus ember border plus ring; error danger border plus message under the field. Native selects share the field style with a chevron (`SelectInput`). The delivery-zone field is a type-to-filter combobox listing each zone with its fee.

### Navigation
Sticky header on the page colour with 44px square controls; back arrow points right. Category bar sticky under it, with edge fades and arrow buttons from 1024px.

### Order-number card (signature)
The order number at 40px under a gold arch taken from the logo frame, with copy and WhatsApp share.

## Do's and Don'ts
### Do:
- Use ember only for actions and active states; one primary action per view.
- Keep every price the customer sees the price the restaurant charges.
- Show real states (open, closed, waiting time) in the state colours above.
- Respect reduced motion: windows fade in place instead of sliding.

### Don't:
- Don't add photos, offers, badges or testimonials that the owner did not supply.
- Don't use the gold for text, or the arch outside the two places above.
- Don't introduce new greys or Tailwind palette colours; add a token instead.
- Don't make the board decorative: speed of scanning wins.
