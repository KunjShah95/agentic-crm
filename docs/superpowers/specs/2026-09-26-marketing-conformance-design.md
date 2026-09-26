# Phase 4 — Marketing Token Conformance

**Date:** 2026-09-26
**Status:** Approved
**Scope:** Bring the marketing surface under the same token system as the app, and extend the conformance harness to cover it. **No redesign** — the marketing site is deliberately more expressive than the app and is already on-brand.

---

## Problem

The marketing surface (`app/(marketing)/**`, `components/landing/**`) was explicitly excluded from the Phase 1 conformance scope, so it has accumulated the same token drift the app just shed:

| Violation | Count | Files |
|---|---|---|
| `font-mono` chrome | 22 | 11 |
| off-scale radius (`rounded-lg/xl/2xl`) | 16 | 11 |
| raw palette 400–700 | 4 | 2 |
| arbitrary radius `rounded-[20px]` | 3 | 3 |

Marketing is **not** visually broken — it is coherent and on-brand (Fraunces hero, copper accent, `--hero-wash-*` tokens, ShaderBackground + SpotlightGrid). This phase is conformance, not craft.

## The deliberate difference: marketing is expressive, the app is restrained

Do **not** flatten marketing to the app's austerity. These stay, documented as intentional:

- `hero.tsx:139` — brand glow `blur-2xl` blob. The app's Direction A bans decoration; a landing hero may have one.
- `ShaderBackground`, `SpotlightGrid` — signature motion layers.
- `rounded-full` on hero CTAs, pills, badges — correct marketing register.
- `backdrop-blur-2xl` on the sticky `site-header.tsx:24` — functional frosted glass, same class of thing as the app topbar.

The `blur` conformance rule therefore **stays scoped to the workspace shell** exactly as Phase 1 left it. No change to `token-surfaces.test.ts`.

## Rules

Bring these under the existing rules, using the same semantics as the app:

1. **Radius** — 16 off-scale + 3 arbitrary → `rounded-xs` (≤24px) / `rounded-sm` (25–40px) / `rounded-md` (>40px). `rounded-full` untouched. Same size→step table as Phase 1 Task 2.
2. **`font-mono`** — keep only with `data-mono="money|id|secret|url"` on the same element, exactly as the app. Strip the rest. `<kbd>` (hero.tsx:69) is a keyboard key glyph — treat as chrome unless it carries a marker; prefer stripping.
3. **Palette** — 4 raw colors → status tokens. `thank-you/page.tsx:30` `bg-emerald-500` → `bg-status-positive-bg`. `hero.tsx:77-79` `bg-red-400`/`bg-amber-400`/`bg-green-400` are **status dots inside a mock-UI illustration** (read the context first) — if they depict a product screenshot rather than a live status, they are illustrative data, not chrome, and stay raw with a comment explaining why.
4. **Scope** — extend `tests/helpers/source-scan.ts` so `components/landing` and `app/(marketing)` are covered by the radius, type, and status rules. They stay excluded from the **blur** rule (see above).

## Verification

- [ ] Radius: `rounded-[Npx]` and off-scale radius gone from marketing
- [ ] Every remaining marketing `font-mono` carries a `data-mono` marker
- [ ] Zero raw palette 400–700 in marketing, except documented illustrative dots
- [ ] `SCOPE` includes marketing; the three existing rules pass with marketing added
- [ ] Token suites green (6 files, 18 tests)
- [ ] `npm run typecheck` clean, `npm run build` succeeds
- [ ] Manual pass: hero, product, pricing, contact, thank-you render unchanged apart from the token swaps

## Risks

| Risk | Mitigation |
|---|---|
| Radius tightening flattens marketing's softer register | Size→step table keeps pills/cards distinct; `rounded-full` untouched preserves the marketing feel |
| Marking the whole marketing surface could be noisy | Same marker convention as the app; if >3 entries are needed, that is a signal a section needs a design pass, not a marker |
