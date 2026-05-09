# Release Infrastructure Plan

Date: 2026-05-09
Status: Active initial release

## Objective

Publish `つぎたく` as a low-cost static web app while preserving the local-first privacy boundary and avoiding avoidable API-key risk.

## Recommended Initial Stack

- Host: Cloudflare Pages
- Source: GitHub repository
- Build command: `pnpm run build`
- Output directory: `dist`
- Package manager: `pnpm@11.0.8`
- Runtime: static files only
- Public URL: https://trpg-gm-copilot.pages.dev/
- Domain: start with Cloudflare `pages.dev`; add a custom domain after smoke verification
- Analytics: none for the first release
- Backend: none for the first release

## Required Repository Files

- `LICENSE`: project license.
- `THIRD_PARTY_NOTICES.md`: direct dependency license summary.
- `PRIVACY.md`: local-first data handling and provider request boundary.
- `TERMS.md`: no-warranty, user responsibility, provider responsibility, and no hosted data recovery.
- `SECURITY.md`: security reporting and sensitive-data handling.
- `public/_headers`: Cloudflare Pages security headers.
- `public/.well-known/security.txt`: deployed security-report discovery file.
- `docs/release-checklist.md`: public-release gate checklist.

## Cloudflare Pages Setup

1. Create a Cloudflare Pages project connected to the GitHub repository.
2. Select `main` when publishing the first preview or production deployment.
3. Configure:
   - Build command: `pnpm run build`
   - Build output directory: `dist`
   - Environment variable: none required for public launch
4. Deploy.
5. Confirm `dist/_headers` is present in the build output.
6. Open https://trpg-gm-copilot.pages.dev/ in a fresh browser profile.
7. Run the release checklist before sharing the URL.

## Current Deployment Verification

Verified on 2026-05-09:

- `https://trpg-gm-copilot.pages.dev/` returns the current Japanese `つぎたく` HTML.
- `/.well-known/security.txt` returns `text/plain` and includes `Expires: 2027-05-09T00:00:00Z`.
- Response headers include `Content-Security-Policy`, `Permissions-Policy`, `Referrer-Policy`, `X-Content-Type-Options`, and `X-Frame-Options`.
- The stale `workers.dev` deployment should not be used for public sharing.

## Security Headers

`public/_headers` is copied by Vite into `dist/_headers` and applied by Cloudflare Pages.

Important current CSP allowance:

- `connect-src https://api.openai.com` for OpenAI extraction/transcription.
- `connect-src http://localhost:* http://127.0.0.1:*` for local Ollama-style endpoints.
- `Permissions-Policy` allows microphone on self so the optional Web Speech flow can still request browser permission.

Do not advertise arbitrary hosted provider endpoints until the CSP, privacy notice, and threat model are updated.

## Cost Guardrails

- Start without custom domain, analytics, backend functions, image optimization services, or server logs export.
- Do not enable paid Cloudflare add-ons during initial smoke release.
- If a custom domain is needed, domain registration is the first unavoidable cost.
- If AWS is introduced later, add AWS Budgets, billing alerts, least-privilege IAM, and teardown instructions before deployment.

## Rollback

Cloudflare Pages supports previous deployment rollback. If launch verification fails:

1. Revert the deployment to the previous passing build.
2. Disable public sharing of the URL.
3. Record the failure in release notes or an issue.
4. Patch and redeploy only after `pnpm run check` and the release checklist pass.

## Future Upgrade Path

Add a backend or local proxy only when one of these becomes necessary:

- Server-side provider key isolation.
- Team/account sync.
- Paid plan enforcement.
- Abuse controls.
- Durable cloud backup.
- Organization-managed data retention.

Until then, static hosting is the better product fit.
