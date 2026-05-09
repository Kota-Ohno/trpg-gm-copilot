# Release Readiness Plan

Date: 2026-05-09
Status: Complete

## Objective

Prepare `つぎたく` for an initial low-cost public release by adding the legal, privacy, security, deployment, and verification materials needed to publish a static build responsibly.

## Success Criteria

- License and direct dependency notices are present.
- Privacy, terms, and security reporting documents are present and match the local-first architecture.
- Initial hosting recommendation is documented with official-source research.
- Cloudflare Pages static security headers are included in build output.
- Release checklist is concrete enough to run before public sharing.
- `pnpm run check` passes.

## Plan Review

SubAgents were not used because the user did not explicitly request delegation in this turn. Role-based review fallback:

- Product fit: A static launch preserves local-first positioning and avoids backend cost before product validation.
- Technical design: Cloudflare Pages is sufficient for Vite output; `_headers` gives concrete release hardening without adding dependencies.
- Security/privacy: Legal docs must not overpromise. They should say browser-side keys are not persisted by the app, while acknowledging page-state and device risks.
- UI/UX: No UI changes are needed for this milestone; release docs should not add in-app friction.
- Test strategy: Build output must prove `_headers` is copied to `dist`; normal `pnpm run check` remains the gate.
- Maintainability: Keep release docs plain Markdown and avoid process-heavy infrastructure until a custom domain or backend exists.

## Affected Files

- `LICENSE`
- `THIRD_PARTY_NOTICES.md`
- `PRIVACY.md`
- `TERMS.md`
- `SECURITY.md`
- `public/_headers`
- `public/.well-known/security.txt`
- `docs/research/release-infrastructure-research.md`
- `docs/release-infrastructure.md`
- `docs/release-checklist.md`
- `README.md`
- `package.json`
- `.github/workflows/release-check.yml`

## Verification Commands

```sh
pnpm run check
test -f dist/_headers
test -f dist/.well-known/security.txt
pnpm audit --prod
pnpm audit --dev
```

## Verification Evidence

- `pnpm run release:check` passed on 2026-05-09:
  - 15 test files passed.
  - 131 tests passed.
  - Production build completed.
  - `dist/_headers` existed after build.
  - `dist/.well-known/security.txt` existed after build.
  - `pnpm audit --prod` reported no known vulnerabilities.
  - `pnpm audit --dev` reported no known vulnerabilities.
- `Release Check` GitHub Actions workflow was added so the same gate runs on pull requests and pushes to release/main branches.
- GitHub Actions `Release Check / pnpm release:check` passed on PR #4 at 2026-05-09T01:15:00Z.

## Adversarial Review Notes

- Risk: CSP could block arbitrary custom remote provider endpoints. Disposition: intentional for first release; docs say not to advertise arbitrary remote endpoints until CSP and privacy review are updated.
- Risk: Security headers could break supported local/Web Speech provider flows. Disposition: removed `upgrade-insecure-requests` for `http://localhost` endpoints and allow `microphone=(self)` for browser-mediated speech recognition.
- Risk: CI can consume GitHub Actions minutes on private repositories. Disposition: workflow is scoped to PRs and release/main pushes, has a 10-minute timeout, and runs only the existing release gate.
- Risk: Terms/privacy files are not formal legal advice. Disposition: `TERMS.md` says this is a launch baseline and not a legal-review substitute.
- Risk: Static hosting logs still exist even without app analytics. Disposition: `PRIVACY.md` discloses hosting-provider request metadata.
- Risk: `THIRD_PARTY_NOTICES.md` covers direct dependencies only. Disposition: file explicitly says transitive dependencies are in `pnpm-lock.yaml` and review should be rerun before release/dependency updates.
