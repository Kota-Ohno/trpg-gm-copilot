# Release Checklist

Date: 2026-05-09
Scope: first public static release
Public URL: https://trpg-gm-copilot.pages.dev/

## Preflight

- [ ] Confirm target branch and commit SHA.
- [ ] Confirm `README.md` points to `LICENSE`, `PRIVACY.md`, `TERMS.md`, `SECURITY.md`, `THIRD_PARTY_NOTICES.md`, and release docs.
- [ ] Confirm no real provider keys, campaign secrets, private logs, or player personal data are committed.
- [ ] Confirm `src/assets/public-release/manifest.json` covers committed public-release images.

## Legal And Trust

- [ ] `LICENSE` is present.
- [ ] `THIRD_PARTY_NOTICES.md` is present and matches direct dependencies in `package.json`.
- [ ] `PRIVACY.md` explains local browser storage, provider calls, API-key handling, and static hosting logs.
- [ ] `TERMS.md` explains no hosted data recovery, no warranty, user responsibility, and external provider responsibility.
- [ ] `SECURITY.md` explains safe vulnerability reporting and sensitive data rules.

## Build And Static Output

- [ ] `pnpm install` succeeds.
- [ ] `pnpm run check` succeeds.
- [ ] GitHub Actions `Release Check` succeeds on the release PR.
- [ ] `pnpm audit --prod` reports no known vulnerabilities.
- [ ] `pnpm audit --dev` reports no known vulnerabilities.
- [ ] `pnpm run build` emits `dist/`.
- [ ] `node scripts/verify-release-files.mjs` verifies `dist/_headers` and `dist/.well-known/security.txt` contents.

## Privacy And Security

- [ ] Fresh profile launch creates no account and requires no API key.
- [ ] Provider API key disappears after reload and is not in localStorage/sessionStorage.
- [ ] Campaign JSON export does not include `apiKey`, `providerSecrets`, `Authorization`, or `Bearer`.
- [ ] Support diagnostics do not include provider keys or campaign secrets.
- [ ] OpenAI extraction/transcription sends data only after explicit user action.
- [ ] Local/Ollama endpoint guidance is clear and optional.
- [ ] Browser console shows no secret-bearing errors during provider failures.

## UX Smoke Test

- [ ] Open public entry on desktop width.
- [ ] Open public entry on mobile width.
- [ ] Confirm the value proposition is understandable within 10 seconds.
- [ ] Start the investigation demo without an API key.
- [ ] Create a custom campaign without an API key.
- [ ] Navigate from workbench back to public entry.
- [ ] Run rule-based extraction.
- [ ] Approve/reject candidates.
- [ ] Browse memory and filtered memory exports.
- [ ] Generate/copy/export next-session prep.
- [ ] Preview player-safe handout and confirm blocked secret leaks.
- [ ] Export campaign/library JSON and Markdown.
- [ ] Import a sample or exported campaign.

## Accessibility And Visual

- [ ] Public entry axe scan reports 0 violations.
- [ ] Workbench axe scan reports 0 violations after setting `chronicle-gm.public-entry-seen.v1`.
- [ ] Keyboard focus is visible in public entry, sidebar, tabs, review cards, exports, and provider settings.
- [ ] No horizontal scrolling at narrow mobile width.
- [ ] No clipped labels or overlapping text in Japanese UI.
- [ ] Core color contrast test passes.

## Cloudflare Pages

- [ ] Build command is `pnpm run build`.
- [ ] Output directory is `dist`.
- [ ] No runtime environment variables are required.
- [ ] `https://trpg-gm-copilot.pages.dev/` opens in a fresh browser profile.
- [ ] Response headers include the expected security headers.
- [ ] `/.well-known/security.txt` is reachable after deployment.
- [ ] `/.well-known/security.txt` includes a future `Expires` timestamp.
- [ ] Public URL smoke test passes before custom domain setup.

## Launch Communications

- [ ] Public announcement uses `https://trpg-gm-copilot.pages.dev/`.
- [ ] Announcement says campaign data is local-first and provider/API use is optional.
- [ ] Announcement avoids claiming that the app replaces a human GM.
- [ ] First replies are monitored for provider setup confusion, mobile issues, and privacy questions.
- [ ] Feedback is converted into GitHub issues or release notes rather than being tracked only in SNS replies.

## Post-Release

- [ ] Tag or record the release commit.
- [ ] Record public URL and deployment timestamp.
- [ ] Watch first user feedback for privacy confusion, provider setup confusion, mobile breakage, or import/export failures.
- [ ] Do not enable analytics or cookies without updating `PRIVACY.md`.
