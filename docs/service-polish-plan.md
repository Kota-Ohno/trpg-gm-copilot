# Service Polish Plan

Date: 2026-05-09
Branch: `feature/purge-release-qa-and-name-review`
Status: In progress

## Objective

Bring `つぎたく` closer to a public-quality Japan-first GM workbench by combining market research, security hardening, UI/UX refinement, tests, and adversarial review.

## Success Criteria

- Research: durable research notes cover RPG campaign managers, top productivity/workbench patterns, accessibility, and API-key security.
- Security: OpenAI API keys are not persisted to browser storage, exports, diagnostics, tests, screenshots, or docs examples.
- UX: GM session flow prioritizes log -> extract -> approve -> memory -> prep with reduced cognitive load and clear operational grouping.
- Visual design: typography, color, spacing, radius, focus, and mobile behavior remain dense, calm, and accessible.
- Tests: focused tests cover changed security and UI behavior; `pnpm run check` passes.
- Review: plan and adversarial review findings are documented with dispositions.

## Current Plan

1. Research current official/primary sources and record actionable findings.
2. Harden API-key handling by making provider keys session-only and clearing legacy persisted keys.
3. Refine provider/security UI copy so the risk boundary is obvious before key entry.
4. Re-audit visible strings and docs for `つぎたく`, Release QA removal, and API-key handling.
5. Run full checks and rendered UI verification on desktop/mobile.
6. Document review findings and commit coherent milestones.

## Plan Review

SubAgents were not used because current runtime instructions permit them only when explicitly requested by the user. Role-based review fallback:

- Product fit: Highest leverage is not adding more features; it is reducing risk and cognitive load around the existing GM loop.
- Security/privacy: Client-side API keys cannot be made fully safe. The immediate improvement is to remove persistence, purge legacy saved keys, and explain that production-grade API use needs a backend proxy.
- UI/UX: Avoid a broad visual redesign before securing the API-key path. Provider settings should be visibly lower-risk and non-persistent.
- Test strategy: Add focused SSR tests for provider card copy and diagnostics copy; full browser verification remains required after UI polish.
- Maintainability: Keep the change small and local to provider settings, diagnostics, docs, and tests.

## Verification Evidence

- `npx pnpm@11.0.8 run check` passed after API-key persistence hardening:
  - 14 test files passed.
  - 124 tests passed.
  - Production build completed.
- Static search confirmed no active `localStorage.setItem` path for provider secrets remains; the only provider-secret storage key is the legacy removal key.
- Current startup save path removes both the legacy provider-secret key and the legacy single-campaign storage key after migrating to the library save format.
- Manual adversarial review found that unknown secret-like fields in imported JSON could survive via object spreads. Normalization/export now rebuild campaign/session/live-log/extraction objects from allowlisted fields only, with regression tests.
- Rendered UI smoke check captured public entry and workbench at desktop/mobile widths via Playwright CLI against `http://localhost:5174/`; workbench screenshots were regenerated after the normal-page visual hierarchy pass.

## Adversarial Review

Role-based adversarial review after API-key persistence hardening:

- Security finding: Client-side API-key entry remains inherently sensitive because browser extensions and the page context can still access it. Disposition: documented in research; current mitigation removes persistence and legacy import. Future hosted/pro work should use a backend or local proxy.
- UX finding: Session-only key behavior can surprise users after reload. Disposition: provider settings copy now explicitly says the key is held only in this tab and disappears on reload.
- Regression finding: Legacy campaign imports no longer restore embedded API keys. Disposition: intentional; legacy keys are sensitive and should not be revived from campaign JSON.
