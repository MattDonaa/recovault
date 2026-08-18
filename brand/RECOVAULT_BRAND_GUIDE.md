# RecoVault Brand System — Claude Code Implementation Guide

> This file is the machine-readable source of truth for implementing RecoVault's visual identity in the website and dashboard.

## 1. Brand Core

**Brand:** RecoVault  
**Tagline:** `SCAN • PROVE • RECOVER`  
**Positioning:** Marketplace revenue recovery and evidence-led reconciliation.  
**Brand promise:** RecoVault scans marketplace data, proves discrepancies with traceable evidence, and helps sellers pursue recoverable revenue.

RecoVault is **not** a bank, escrow service, crypto product, security vault, military/security brand, or generic AI product.

### Brand personality
- Warm
- Trustworthy
- Premium
- Modern
- Professional
- Financially credible
- Evidence-led
- Calm rather than flashy

### Brand principle
**Trust first. Gold signals value; it must not dominate the interface.**

---

## 2. Supplied Logo Assets

Place these files in the application under:

`/public/brand/`

| Asset | Intended use |
|---|---|
| `favicon-master.png` | Favicon source, app icon, very small square placements |
| `website-logo-master.png` | Primary website/header lockup |
| `wordmark-lockup-master.png` | RecoVault wordmark + tagline lockup without R symbol |
| `r-symbol-master.png` | Standalone R/magnifier brand mark |

### Usage hierarchy
1. **Website/header:** `website-logo-master.png`
2. **Sidebar/app shell:** `r-symbol-master.png` + text rendered separately when space permits
3. **Favicon/browser/app icon:** `favicon-master.png`
4. **Documents/social banners:** website logo or wordmark lockup depending on composition

### Clear-space rule
Maintain clear space around a logo equal to at least **25% of the R symbol's height**. Never crowd it against cards, navigation borders, text, or page edges.

### Minimum practical sizes
- Favicon: 16px / 32px / 48px generated from favicon master.
- Standalone R: do not render below 28px in product UI unless using the dedicated favicon.
- Website lockup: target 160–220px CSS width on desktop; 132–170px on mobile depending on header.
- Wordmark lockup: minimum ~180px CSS width when tagline is visible.

### Never
- recolor individual logo elements arbitrarily;
- stretch or skew;
- rotate;
- add glow/neon effects;
- add a new gradient;
- place the full tagline at unreadably small sizes;
- recreate the logo with CSS;
- add generic AI sparkles, robot imagery, shields, padlocks, vault doors, coins, crypto motifs, shopping carts, or military/security motifs.

---

## 3. Colour System

The logo artwork is authoritative. For UI implementation use this restrained companion palette.

```css
:root {
  --rv-navy-950: #071B38;
  --rv-navy-900: #0A2854;
  --rv-navy-800: #103A73;
  --rv-blue-700: #164E9A;
  --rv-blue-600: #1D62C5;

  --rv-gold-600: #C99118;
  --rv-gold-500: #D9A62E;
  --rv-gold-400: #E6BC5A;

  --rv-ink: #111827;
  --rv-slate-700: #334155;
  --rv-slate-500: #64748B;
  --rv-slate-300: #CBD5E1;
  --rv-slate-200: #E2E8F0;
  --rv-surface: #FFFFFF;
  --rv-surface-warm: #FBFAF7;
  --rv-background: #F6F8FB;

  --rv-success: #16805B;
  --rv-warning: #A66A12;
  --rv-danger: #B42318;
  --rv-info: #1D62C5;
}
```

### Colour ratios
For normal product screens:
- **65–75%** white / warm neutral surfaces
- **20–30%** navy / blue
- **5–10% maximum** gold accents

Gold communicates **recovered value, verified value, or premium emphasis**. It is not the default button/background colour.

### Semantic use
- Navy: navigation, primary buttons, headings, trusted structure.
- Blue: links, active states, charts, focus states.
- Gold: recovered-value highlights, selected premium accents, logo.
- Green: actual positive/recovered status. Do not replace semantic green with gold.
- Red: errors/loss/critical states only.

---

## 4. Typography

### Primary UI family
**Inter** — use for dashboard UI, tables, forms, body copy, labels, numbers and dense data.

Fallback:
`Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

### Display/marketing family
**Manrope** — use for website hero headings, major marketing headings and selected high-impact section titles.

Fallback:
`Manrope, Inter, ui-sans-serif, system-ui, sans-serif`

### Implementation
Use `next/font/google` so fonts are self-hosted by Next.js at build/runtime and do not require manual font files.

```ts
import { Inter, Manrope } from "next/font/google";

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});
```

### Type scale

| Token | Desktop | Mobile | Weight | Use |
|---|---:|---:|---:|---|
| Display XL | 56/64 | 40/48 | 700 | marketing hero only |
| H1 | 40/48 | 32/40 | 700 | page/marketing title |
| H2 | 32/40 | 28/36 | 700 | major sections |
| H3 | 24/32 | 22/30 | 650–700 | cards/sections |
| H4 | 20/28 | 18/26 | 650 | subsections |
| Body L | 18/30 | 17/28 | 400 | marketing body |
| Body | 16/24 | 16/24 | 400 | standard copy |
| Body S | 14/20 | 14/20 | 400–500 | dashboard/supporting |
| Label | 13/18 | 13/18 | 600 | controls/metadata |
| Caption | 12/16 | 12/16 | 500 | helper text |
| Metric XL | 36/40 | 30/36 | 700 | key financial metric |

Use tabular numerals for financial values where supported:
`font-variant-numeric: tabular-nums;`

### Typography rules
- Sentence case for UI.
- Avoid all-caps except tiny category/eyebrow labels.
- Tagline is the exception and remains `SCAN • PROVE • RECOVER`.
- Keep line length around 60–75 characters for marketing body copy.
- Avoid ultra-light font weights.

---

## 5. Spacing, Shape & Elevation

### Base spacing
Use a 4px base grid.

Preferred sequence:
`4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96`

### Radius
- Inputs/buttons: 8–10px
- Cards: 12px
- Large marketing surfaces: 16px
- Pills/badges: full radius only when semantically appropriate

Do not turn the entire interface into rounded pills.

### Shadows
Use restrained shadows only:
- cards: subtle 1–2 level elevation;
- dialogs/dropdowns: moderate elevation;
- no glow;
- no gold shadows;
- no glassmorphism as the default visual language.

### Borders
Prefer `#E2E8F0` / slate-200. Use navy borders only for strong active/selected states.

---

## 6. Website Visual Direction

### Header
- White or warm-white background.
- Primary website logo left.
- Navigation uses Inter 14–15px / 500–600.
- Primary CTA: navy background, white text.
- Gold appears only as a small accent.

### Hero
- Warm-white or very pale neutral canvas.
- Manrope H1.
- Navy headline; selectively emphasize one short phrase with blue or restrained gold.
- Avoid giant gradients and abstract AI blobs.
- Visuals should communicate marketplace reconciliation, evidence, discrepancies, and recovered revenue.

### CTA
Primary:
- navy background
- white text
- 44–48px height
- 9–10px radius

Secondary:
- white/transparent
- navy border/text

Do not use gold as the default primary CTA.

---

## 7. Dashboard Visual Direction

The dashboard should feel like a **professional financial operations cockpit**, not a marketing page.

### App shell
- Light main canvas.
- Deep navy sidebar or restrained white sidebar with navy active states.
- Use standalone R mark in compact sidebar.
- Use full RecoVault wordmark only when width permits.

### Dashboard cards
- White surfaces.
- Thin neutral border.
- 12px radius.
- Very subtle shadow.
- Headings 14–16px.
- Large metrics use Inter 28–36px / 700 with tabular numerals.

### Money Finder
Potential recovery should be visually important without looking like gambling/crypto:
- amount in navy/ink;
- small gold accent or icon for potential value;
- green only when recovery is actually verified/recovered;
- clear confidence/status badges.

### Tables
- Inter 13–14px.
- 44–48px row height.
- Sticky headers where useful.
- Numeric columns right aligned.
- Currency values tabular.
- Avoid excessive zebra striping.
- Use neutral separators.

### Charts
- Default series: blue/navy.
- Gold: highlight one financially meaningful series or selected state.
- Green: verified recovery.
- Red: discrepancy/error.
- Never use rainbow charts unless category count genuinely requires it.

---

## 8. Component Tokens

Suggested Tailwind/shadcn semantic mapping:

```ts
const brand = {
  background: "#F6F8FB",
  surface: "#FFFFFF",
  surfaceWarm: "#FBFAF7",
  foreground: "#111827",
  mutedForeground: "#64748B",
  primary: "#0A2854",
  primaryForeground: "#FFFFFF",
  secondary: "#164E9A",
  accent: "#D9A62E",
  border: "#E2E8F0",
  success: "#16805B",
  warning: "#A66A12",
  destructive: "#B42318",
};
```

### Buttons
- Primary: navy.
- Secondary: white + navy border.
- Destructive: semantic red.
- Ghost: transparent with navy/neutral hover.
- Gold button: exceptional marketing emphasis only, never routine dashboard action.

### Status badges
- `detected`: blue/neutral
- `investigating`: amber/gold family
- `accepted`: navy/blue
- `dismissed`: slate
- `submitted`: blue
- `under_review`: amber
- `payment_expected`: blue/gold
- `recovered`: green
- `closed`: slate

---

## 9. Accessibility

- Target WCAG 2.2 AA.
- Normal text contrast >= 4.5:1.
- Large text >= 3:1.
- Do not place gold text on white for body copy.
- Do not communicate status by colour alone.
- Visible keyboard focus ring.
- Minimum interactive target ~44x44px where practical.
- Every logo image must have appropriate alt text:
  - linked home logo: `RecoVault`
  - decorative repeated symbol: empty alt
- Respect `prefers-reduced-motion`.

---

## 10. Motion

Motion should communicate system state, not spectacle.

- 150–220ms UI transitions.
- Ease-out for entrances.
- No bouncing money, spinning coins, glowing AI animations, or continuous logo animation.
- Loading states use restrained skeletons/progress indicators.

---

## 11. Copy & Brand Voice

### Voice
- Precise
- Calm
- Evidence-led
- Commercially useful
- Professional
- Never hype-heavy

### Preferred language
- potential recovery
- recovery candidate
- anomaly
- evidence
- reconciliation
- verified recovery
- source records
- marketplace account

### Avoid
- guaranteed money
- instant cash
- AI magic
- autonomous recovery genius
- marketplace owes you
- bulletproof claim
- vault/security metaphors

### Tagline
Always write:
**SCAN • PROVE • RECOVER**

Do not replace with AI-oriented slogans.

---

## 12. Responsive Logo Logic

Implement a reusable `<BrandLogo />` component with variants:

```ts
type BrandLogoVariant =
  | "website"
  | "wordmark"
  | "symbol"
  | "favicon";
```

Recommended behavior:
- desktop marketing header: `website`
- mobile marketing header: `wordmark` or compact website lockup
- expanded dashboard sidebar: `wordmark` or symbol + text
- collapsed sidebar: `symbol`
- browser metadata: `favicon`

Do not use CSS filters to recolor raster logo assets.

---

## 13. Suggested File Placement

```text
public/
└── brand/
    ├── favicon-master.png
    ├── website-logo-master.png
    ├── wordmark-lockup-master.png
    └── r-symbol-master.png

src/
├── components/
│   └── brand/
│       └── BrandLogo.tsx
├── config/
│   └── brand.ts
└── app/
    └── globals.css
```

---

## 14. Claude Code Implementation Contract

When implementing branding:

1. Inspect this file and `BRAND_TOKENS.json`.
2. Confirm supplied assets exist before referencing them.
3. Copy assets to `/public/brand/` without altering their pixels unless explicitly instructed.
4. Create semantic tokens; do not scatter raw hex codes through components.
5. Implement typography through `next/font`.
6. Implement the reusable BrandLogo component.
7. Apply branding incrementally to existing components without changing business logic.
8. Preserve all current tests.
9. Add visual/component tests for BrandLogo variants where appropriate.
10. Run typecheck, lint, tests and build.
11. Do not redesign the logo.
12. Do not introduce a new colour palette.
13. Do not add generic AI visual language.
14. Do not modify recovery-engine semantics while applying branding.

### Definition of done
Brand implementation is complete when:
- supplied assets are correctly served;
- favicon metadata uses the favicon asset;
- website header uses the correct lockup;
- dashboard shell uses responsive brand variants;
- Inter/Manrope are applied consistently;
- semantic brand tokens are centralized;
- accessibility contrast is acceptable;
- mobile and desktop layouts do not distort/crop logos;
- tests/build remain GREEN.

---

## 15. One-Sentence Design Test

Before approving any UI choice, ask:

> **Does this look like a trustworthy marketplace revenue-recovery platform that proves financial discrepancies, or like generic fintech/AI/crypto software?**

If the latter, simplify it.
