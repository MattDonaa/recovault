# RecoVault Branding Implementation Prompt for Claude Code

Read these files before changing UI:
1. `RECOVAULT_BRAND_GUIDE.md`
2. `BRAND_TOKENS.json`
3. the existing `00-claude.md`
4. current `docs/PROJECT_STATE.md`
5. current milestone file

The brand guide is authoritative for visual implementation, but it does NOT override the milestone scope or GREEN-gate rules in `00-claude.md`.

Your task when branding is within the currently permitted milestone:
- copy supplied assets from `assets/` into `public/brand/`;
- create centralized semantic brand tokens;
- use Inter for UI/body/data and Manrope for marketing/display headings via `next/font`;
- create a reusable `BrandLogo` component with website, wordmark, symbol, and favicon variants;
- apply the visual system without changing business logic;
- preserve marketplace-agnostic architecture;
- do not redraw or reinterpret the logo;
- do not add AI/crypto/vault/security imagery;
- keep gold restrained and use semantic green for actually recovered money;
- meet WCAG AA contrast;
- verify responsive logo behavior;
- run the complete milestone GREEN gate before declaring success.

If branding work is outside the currently allowed milestone, STOP and report that it must wait for the appropriate milestone rather than violating the engineering constitution.
