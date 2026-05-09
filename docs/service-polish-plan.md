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
  - 15 test files passed.
  - 129 tests passed in the latest full check after adding landmark accessibility regression coverage.
  - Production build completed.
- Static search confirmed no active `localStorage.setItem` path for provider secrets remains; the only provider-secret storage key is the legacy removal key.
- Current startup save path removes both the legacy provider-secret key and the legacy single-campaign storage key after migrating to the library save format.
- Manual adversarial review found that unknown secret-like fields in imported JSON could survive via object spreads. Normalization/export now rebuild library/campaign/session/live-log/extraction objects from allowlisted fields only, with regression tests.
- Support diagnostics now has a regression test proving contaminated `sk-`-like fields are not serialized into diagnostics JSON.
- Removed the unused `normalizeProviderSecretSettings` helper so provider secrets have no remaining import/persistence normalization path.
- Rendered UI smoke check captured public entry and workbench at desktop/mobile widths via Playwright CLI against `http://localhost:5174/`; workbench screenshots were regenerated after the normal-page visual hierarchy pass.
- Color contrast spot check found white text on `public-seaglass` at 3.34:1; the token was darkened to 4.87:1, and `src/styles-contrast.test.ts` now keeps core CSS token pairs above WCAG AA for normal text.
- Automated axe smoke checks now cover both public entry and the localStorage-enabled workbench. Public entry reported 0 violations via `@axe-core/cli`; workbench initially reported `landmark-unique`, then passed with 0 violations after adding unique accessible labels to the sidebars and memory navigation.
- `git diff --check origin/feature/voice-transcription-research...HEAD`, `npx pnpm@11.0.8 audit --prod`, and `npx pnpm@11.0.8 audit --dev` passed.
- PR `@codex review` completed with no major issues on the earlier patch set and was re-triggered for the latest HEAD after the landmark accessibility regression-test commit.
- Completion audit is tracked in `docs/service-polish-completion-audit.md`; goal is intentionally not marked complete while the latest Codex review is pending.

## Adversarial Review

Role-based adversarial review after API-key persistence hardening:

- Security finding: Client-side API-key entry remains inherently sensitive because browser extensions and the page context can still access it. Disposition: documented in research; current mitigation removes persistence and legacy import. Future hosted/pro work should use a backend or local proxy.
- UX finding: Session-only key behavior can surprise users after reload. Disposition: provider settings copy now explicitly says the key is held only in this tab and disappears on reload.
- Regression finding: Legacy campaign imports no longer restore embedded API keys. Disposition: intentional; legacy keys are sensitive and should not be revived from campaign JSON.
