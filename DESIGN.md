---
name: Imprimete C.A. — Catálogo
description: Un catálogo de insumos de impresión donde el propio aro de tres arcos del logo hace el trabajo — selector de marca, medidor de existencia, indicador de carga — en vez de decorarlo.
colors:
  paper: "#ffffff"
  paper-dim: "#f4f5f7"
  paper-line: "#e4e6eb"
  ink: "#14161f"
  ink-muted: "#5b5f6c"
  ink-faint: "#667085"
  brand-navy: "#213B86"
  brand-magenta: "#E2057D"
  brand-magenta-deep: "#B8055F"
  brand-cyan: "#1D9AD6"
  brand-yellow: "#F3E823"
  brand-amber: "#B58900"
  whatsapp: "#22C35E"
  chrome-scrollbar: "#d7dae1"
  chrome-scrollbar-hover: "#b9bec9"
typography:
  body:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
  title:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.375
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    letterSpacing: "0.02em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.brand-navy}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 0"
  button-primary-hover:
    backgroundColor: "#152a63"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
  button-whatsapp:
    backgroundColor: "{colors.whatsapp}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "12px 0"
  chip-brand:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
  chip-brand-active:
    backgroundColor: "{colors.paper-dim}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  card-product:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.lg}"
  panel-header-reversed:
    backgroundColor: "{colors.brand-navy}"
    textColor: "#ffffff"
    padding: "12px 16px"
---

# Design System: Imprimete C.A. — Catálogo

## Overview

**Creative North Star: "El Ciclo de Refill"**

The system is built around a single working mechanism: the three-arc loop from the Imprimete logo, put to real use instead of left as a badge. The same geometry spins as a loading indicator, rotates as the accent under brand-filter chips, and reads as a continuous stock gauge on every product card. The world is otherwise near-achromatic — white paper, near-black ink, a faint technical grid — so the four brand colors (navy, magenta, yellow, cyan) read as signal precisely because they appear nowhere else as fill, only as arcs and borders.

This is an Operate-mode surface: a visitor who already knows the product code or name searches directly, scans a dense, calm, price-list-like grid, and closes a WhatsApp order. There is no hero, no marketing copy, no imagery beyond real product photos — the build measurably rejects both the neutral-card-with-accent catalog and the dark neon "gamer store" alternative named in the direction contract. Hierarchy is carried by weight, uppercase, and — in exactly one place — a reversed (inverted) navy band, never by decorative elements layered on top.

**Key Characteristics:**
- Near-achromatic base (white/black/gray) with the four brand hues reserved for arcs, borders, and small accents — never large fills.
- A single signature mechanism (the loop) doing three real jobs: sync indicator, brand-filter accent, stock gauge.
- State is doubled in form, not just color: stock reads as arc completeness *and* exact unit count; "agotado" (out of stock) breaks the circle into a strikethrough, never just a gray dot.
- Tabular tone throughout: monospace for codes and prices, dense grid, price-sheet rhythm.
- One deliberate hierarchy inversion (white-on-navy), reserved for the cart/order moment only.

## Colors

Near-achromatic paper-and-ink base; the four brand hues are structural signal, not decoration, and are rationed to line work.

### Primary
- **Refill Navy** (`#213B86`): the loop's calm anchor arc. Used as the solid fill for primary actions (Agregar / add-to-cart), the focus-ring/selection color, and the surface's one reversed hierarchy band (cart panel/drawer header).

### Secondary
- **Loop Magenta** (`#E2057D`): one of the three rotating arcs; used as a chip accent border and in the cart-count badge. **Loop Magenta Deep** (`#B8055F`) is the same hue darkened for text/badges and error copy — the pure magenta only reaches ~4.2:1 on white, below the 4.5:1 floor, so anything carrying text meaning uses the deep variant; the pure hue stays reserved for arcs/borders.
- **Loop Cyan** (`#1D9AD6`): the third rotating arc; used as the "disponible" (in-stock) stock-gauge color and the global focus-visible outline.

### Tertiary
- **Loop Yellow** (`#F3E823`): the second rotating arc, used only as a graphic arc/border accent (chip underline). **Loop Amber** (`#B58900`) is the darkened stand-in wherever the yellow needs to carry meaning (the "bajo" / low-stock gauge state, an active chip accent) — the pure yellow is legible on white only as a thin stroke, never as a value-bearing surface.

### Neutral
- **Paper** (`#ffffff`): base background, card surfaces.
- **Paper Dim** (`#f4f5f7`): the technical-grid band background, quantity-stepper track, unselected-chip rest fill.
- **Paper Line** (`#e4e6eb`): all hairline borders — cards, header, chip strokes, stock-gauge track.
- **Ink** (`#14161f`): primary text.
- **Ink Muted** (`#5b5f6c`): secondary text (labels, chip text at rest).
- **Ink Faint** (`#667085`): tertiary text (SKU codes, "agotado" state) — deliberately darker than "faint" would suggest, so it still clears 4.5:1 on white.
- **WhatsApp Green** (`#22C35E`): reserved for the one send-to-WhatsApp action; not part of the brand ramp, borrowed for platform recognition.
- **Chrome Scrollbar** (`#d7dae1`) / **Chrome Scrollbar Hover** (`#b9bec9`): a browser-chrome-only tier, one step darker than Paper Line and one step lighter than Ink Faint — themes the custom scrollbar thumb per the craft floor's "theme browser surfaces" rule. Scoped to `::-webkit-scrollbar-thumb` / `scrollbar-color` only; never used for text, borders, or fills elsewhere.

### Named Rules
**The Line-Not-Fill Rule.** The four brand hues (navy excluded, since navy also serves as the neutral "primary action" color) never appear as a large fill. They live as arcs, borders, and small badges — chip underlines, stock gauges, the loop mark itself.

**The Doubled-State Rule.** Any state carried by a brand color (in-stock / low / out-of-stock) is also carried by a second, non-color channel: arc completeness plus the exact unit count in text, and a strikethrough line (not just a gray fill) for "agotado."

## Typography

**Body Font:** IBM Plex Sans (self-hosted via `next/font/google`, with `ui-sans-serif, system-ui` fallback)
**Label/Mono Font:** IBM Plex Mono (self-hosted, with `ui-monospace, SFMono-Regular` fallback)

**Character:** A technical-instrument pairing — Plex Sans carries names and actions at plain weights, Plex Mono marks anything that is a measured value (SKU code, price, quantity) so the eye can tell "identifier" from "label" without color.

### Hierarchy
- **Title** (500, 0.875rem/14px, 1.375 line-height): product names, panel headings ("Tu pedido").
- **Body** (400, 0.875rem/14px, 1.4): search placeholder, empty-state copy, cart line-item labels.
- **Label** (400, 0.6875–0.75rem, mono, tabular-nums): SKU codes, prices, unit counts, "N disp." stock text.

### Named Rules
**The Tabular-Nums Rule.** Anywhere digits form a column that a customer will scan down (prices, codes, quantities), the value is rendered in `font-variant-numeric: tabular-nums` mono so the column aligns like a real price sheet rather than drifting with proportional widths.

## Layout

A dense, list-like product grid inside a `max-w-6xl` centered container, with one sticky rail: a 208px (`w-52`) filter panel on the left at `xl+` only. The cart has no persistent desktop panel — at every width it is a header icon button plus a drawer, kept deliberately identical across breakpoints rather than upgrading to a sidebar at rest. Grid tiles run large and few: 2 columns on mobile, 3 from `md` up, uncapped at wider desktop — the freed cart-rail width goes to bigger tiles, not more columns. The price/stock row inside each card is `flex-wrap`: on the narrowest 2-column phone width it drops to two lines instead of clipping, rather than adding a third column to make room. Below `xl`, the filter rail collapses into a left-side drawer (85%, max `max-w-sm`) triggered from a header icon button, opposite the cart's drawer on the right, so the grid stays full-width instead of stacking filter controls above it. The header is sticky (`top-0 z-20`), two-band: a slim wordmark-and-icon-buttons row over a full-width search row. There is no hero and no marketing band above the grid — the search bar is the first primary action, and the grid begins immediately after it.

## Elevation & Depth

Flat by default; the two shadow tokens in use are shallow and reserved for float, not weight. Cards rest on a hairline border (`border-paper-line`) plus a soft ambient shadow; the mobile cart drawer and its scrim get a slightly deeper shadow to read as temporarily above the page.

### Shadow Vocabulary
- **card** (`box-shadow: 0 1px 2px rgba(20,22,31,0.04), 0 8px 20px -12px rgba(20,22,31,0.18)`): product cards, desktop cart panel.
- **panel** (`box-shadow: 0 12px 32px -16px rgba(20,22,31,0.28)`): the mobile cart drawer, which sits above a dark scrim.

### Named Rules
**The No-Backdrop-Blur Rule.** The sticky header is a solid `bg-paper`, not a blurred translucent one — a blur was tried and removed because the header sits over a near-opaque background where the blur was a no-op. Don't add backdrop-filter unless the element actually sits over moving, translucent content.

## Shapes

Corners are gently rounded and consistent: `rounded-md` (8px, ~6px in Tailwind's own scale) for inputs, chips, and buttons; `rounded-lg` (12px) for product cards and panels; `rounded-full` for the cart-count badge and the loop/gauge circles themselves. Borders are 1px hairlines everywhere except the active brand chip, which carries a 3px bottom border in its rotating accent color — the one place stroke-weight itself carries state. No hard/offset shadows, no sharp corners: the geometry is soft and circular, matching the loop motif.

## Components

### Buttons
- **Shape:** `rounded-md` (~8px).
- **Primary:** solid Refill Navy (`#213B86`) fill, white text, `py-2` — used for "Agregar" (add to cart). Disabled state drops to `paper-dim` fill with `ink-faint` text (no color-only disabled cue beyond that, since the button also becomes inert).
- **WhatsApp CTA:** solid WhatsApp green (`#22C35E`) fill, white text, `MessageCircle` icon (lucide-react) — standardized to match the rest of the icon system rather than a brand WhatsApp glyph.
- **Hover / Focus:** primary darkens to `#152a63` on hover; global focus-visible uses a 2px Loop Cyan (`#1D9AD6`) outline with 2px offset.
- **Quantity stepper:** once a product is in the cart, "Agregar" is replaced by a `paper-dim` pill housing Minus/Plus icon buttons on white rounded squares with a light shadow.

### Filter panel (department & brand)
- **Placement:** a `w-52` sticky rail to the left of the grid at `xl+` — the only persistent rail on the page now that the cart has none; below `xl`, it lives in a left-side drawer opened by a header "Filtros" icon button, mirroring the cart drawer's button and motion on the opposite edge.
- **Rows, not chips:** each filter is a vertical list of single-select rows (Departamento above Marca), not a horizontal chip scroll — 29 departments and 48 brands don't scan as a chip row, and a vertical list keeps the grid starting at the same height it always did instead of pushing it down. Each section caps at `max-h-64` with the themed scrollbar handling overflow.
- **State:** the active row gets `paper-dim` background, `ink` text, and a 3px left border lit in the rotating accent (magenta → amber → cyan, cycling by row index) — the same line-not-fill accent the old chip row used, translated from a bottom border to a left border for a vertical list.
- **Active-count badge + clear:** the header's "Filtros" button carries the same numeric badge (`brand-magentaDeep` circle) as the cart button's unit count; a "Limpiar" link appears in the panel/drawer header only once a filter is active.
- **Drawer footer:** the mobile drawer closes with a solid-navy "Ver N productos" button (the same primary-button treatment as "Agregar" and the WhatsApp CTA), giving live feedback on the filtered count before returning to the grid.

### Cards / Containers
- **Corner Style:** `rounded-lg` (12px).
- **Background:** white, with a `paper-dim` + `instrument-grid` image placeholder band (aspect 4:3) when no product photo loads.
- **Shadow Strategy:** the `card` shadow token, plus a 1px `paper-line` border.
- **Internal Padding:** `p-4` on mobile, `p-5` (20px) from `sm` — sized for the large-tile grid (name at `text-base`/`text-lg`, price at `text-xl`/`text-2xl` mono, a 30px `StockGauge`, `py-3` "Agregar").
- **Bs. price line:** every USD price (card, cart line total, cart grand total, WhatsApp message) is followed by its Bs. equivalent at the official BCV rate, one size down and in `ink-faint` — same `tabular font-mono` treatment as the SKU code, read as a secondary/converted value rather than a second primary price. It only renders once the rate has loaded; there is no placeholder or skeleton for it, since the page is fully usable in USD alone.
- **Freshness, not just a fetch-once value:** catalog and rate both reload on mount, on the tab regaining visibility, and every 30 minutes as a backstop — a client who leaves the page open for days should never act on week-old stock, prices, or rate. On-screen, the cart's Bs total carries the rate's own date ("· tasa BCV DD/MM") so staleness is visible, not just prevented; "Enviar pedido por WhatsApp" makes one more short-timeout (2.5s) fetch for the freshest rate before building the message, falling back silently to the last known one. The WhatsApp message itself keeps just the two prices (`$X.XX (Bs. Y.YYY,YY)`) with no rate date — that detail is for the page, not the text the advisor reads.

### Inputs / Fields
- **Style:** white fill, `paper-line` 1px border, `rounded-lg`, generous `py-3 pl-11` to clear the leading search icon.
- **Focus:** border shifts to Refill Navy (`#213B86`); no glow or shadow added.

### Navigation
Not a nav bar in the traditional sense — the header is wordmark plus two icon buttons (Filtros, Carrito) below `xl`, and wayfinding is done through the search input and the department/brand filter panel. On desktop (`xl+`) that panel is a persistent left rail; below it, both the filters and the cart collapse into opposite-edge drawers opened from the header, keeping the grid itself the first thing after the search bar at every width.

### RefillLoop (signature component)
Two SVG primitives share one geometry (three 22%-arc strokes at 120° offsets, colors magenta/yellow/cyan): **LoopMark** spins continuously (`loop-spin`, 1.6s linear) as the loading indicator while the catalog fetches. **StockGauge** repurposes the same ring per-product as a continuous stock arc — cyan and near-full for "disponible," amber and partial for "bajo" (≤3 units), a gray dashed track with a diagonal strikethrough line for "agotado." The arc is always paired with the exact unit count in text; color and shape never carry the state alone.

### Cart Panel / Drawer
One button, one drawer, at every width — deliberately no upgrade to a persistent sidebar at rest on desktop, even though there's now room for one. A right-side drawer enters with `drawer-arc-in` — a 0.42s animation that bows the drawer's leading (left) edge into a full radius at the start and straightens it as it settles, tracing the loop's own curve rather than a flat slide — over the reversed navy header band (`bg-brand-navy`, white text, "Tu pedido").

### Filters Drawer
The mirror image on the opposite edge: enters from the left with `drawer-arc-in-left` (same 0.42s curve, bowed on its trailing/right edge instead), header is plain `paper` with `ink` text — not the reversed navy band, which the Doubled-Band Don't reserves for the cart alone — and closes via a solid-navy "Ver N productos" button instead of a bare X, so leaving the drawer also confirms the result.

### Escáner de código (`/escaner`)
A second, narrower surface (`max-w-2xl`, one column) built from the same tokens — same header treatment, same `instrument-grid`, same card/shadow/tabular-mono language — but a different job: a staff member scans a barcode and the matching product appears, no click required. The one hard requirement drives every choice here: the search input never loses focus. It auto-focuses on mount, on the tab regaining visibility, and after any click anywhere on the page (refocused on the next tick, so the click's own action still fires first); a barcode reader is just a keyboard that types fast and ends with Enter, so the `<form>`'s `onSubmit` is the whole lookup contract. A found product renders large (`text-2xl` name, `text-4xl` price) — a mostly hands-free, glance-from-a-distance result, not a dense card. A miss gets the same `PackageX` empty-state treatment as an empty search on the main catalog. A short "escaneado recientemente" list (last 6, deduped) sits below for re-checking a previous scan without re-aiming the reader; each row is clickable, which still obeys the always-refocus rule.

## Do's and Don'ts

### Do:
- **Do** keep the four brand hues (navy aside) as line/arc/border accents only — never a full-bleed fill, never a background wash.
- **Do** pair any stock or availability state with both an arc/shape change and exact text (unit count or "Agotado"), per the Doubled-State Rule.
- **Do** use `tabular-nums` mono for any column of prices, codes, or quantities.
- **Do** keep the header solid (`bg-paper`), not blurred, unless it will actually sit over moving translucent content.
- **Do** use the pixel-cropped lockup asset (`logo-imprimete-lockup.png`) with `object-contain` for the header mark — it was produced from the source PNG's real pixel bounding box, not a guess, and the padded original (`logo-imprimete.png`) is not the header asset.
- **Do** use `favicon-imprimete.png` (icon only, no wordmark) for the browser-tab icon — provenance: user-supplied source PNG, cropped to its real pixel bounding box and with its white background made transparent (`lib`-adjacent one-off script, not committed), same care as the header lockup. The full lockup/logo would read as an illegible smudge at 16–32px.

### Don't:
- **Don't** introduce a second reversed (inverted-color) band anywhere outside the cart/order header. The navy reversa is reserved for that one hierarchy moment; adding it elsewhere would flatten its meaning.
- **Don't** use hard/offset "neobrutalist" shadows or sharp corners — this world's geometry is soft and circular (the loop), and its shadow vocabulary is ambient, not structural.
- **Don't** add a fourth icon system or a WhatsApp brand glyph for the send button; the CTA icon is `lucide-react`'s `MessageCircle`, matching every other icon on the surface.
- **Don't** treat `marca` as a stand-in for department/category again — a real department chip row now exists (`nombre_departamento`, migrated in `db/05_departamento.sql` and carried through `/api/sync` and `/api/productos`; see `.impeccable/surfaces/app-page-jsx.md`). Reuse that field instead of re-deriving categories from brand.
