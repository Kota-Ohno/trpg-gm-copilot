# Service Polish Research

Date: 2026-05-09
Scope: `つぎたく` public-quality service polish.

## Sources Checked

- OpenAI help: API key safety guidance. https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety
- OWASP Cheat Sheet Series: Secrets Management. https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- W3C WCAG 2.2. https://www.w3.org/TR/WCAG22/
- World Anvil official site and docs. https://www.worldanvil.com/
- Kanka official site and docs. https://kanka.io/
- Obsidian official site and sync/security docs. https://obsidian.md/
- Linear official site/docs for workflow/product patterns. https://linear.app/
- Notion official site/help for workspace/database patterns. https://www.notion.com/

## Market And Product Findings

### RPG Campaign Managers

World Anvil and Kanka both emphasize long-running world/campaign organization: articles, characters, maps, timelines, relationships, and collaborative campaign records. Their strength is breadth and structured worldbuilding. `つぎたく` should not try to become another encyclopedia-first campaign wiki. Its strongest position is session-to-session continuity: a GM workbench that starts from a messy log and produces approved memory, next-session prep, and player-safe output.

Actionable takeaways:

- Keep the first workflow centered on `ログ -> 承認 -> 記憶 -> 次回準備`.
- Treat campaign memory as an output of play, not a large blank wiki the GM must fill manually.
- Keep exports/imports available, but secondary.

### Top Productivity Workbenches

Notion and Obsidian show the value of user-owned content, fast capture, backlinks/structured organization, and templates. Linear shows the value of high-density command surfaces, keyboard-first affordances, status clarity, and low-noise prioritization.

Actionable takeaways:

- Reduce first-screen control inventory; expose the next action and priority risk first.
- Keep sidebar/details available, but make them scannable and calm.
- Prefer precise status labels over large explanatory text.
- Templates should start useful work immediately rather than explaining features.

## Security Findings

OpenAI's API-key safety guidance says keys should not be exposed in client-side code and should be stored outside source control and managed through secure environments. OWASP's secrets guidance similarly treats secrets as sensitive lifecycle-managed material that should not be casually stored, logged, or exposed.

Risk assessment for current architecture:

- This is a Vite static client app. Any browser-entered API key is inherently exposed to that browser context and extensions.
- Persisting an API key in `localStorage` increases risk because it survives reloads, browser restarts, and any later XSS.
- Export and diagnostics exclusion is necessary but not sufficient.

Decision:

- Do not persist provider API keys in browser storage.
- Clear the legacy provider-secrets storage key on app startup.
- Keep keys in React state only for the active tab/session.
- UI must say the key is not saved and disappears on reload.
- A future hosted/pro production version should use a backend proxy or user-controlled local proxy instead of browser-held provider credentials.

## Accessibility And Visual Findings

WCAG 2.2 reinforces several relevant gates for a dense operational app: keyboard access, visible focus, sufficient contrast, target size, labels, status messages, and no layout overflow that blocks content.

Actionable takeaways:

- Keep controls at stable heights and avoid text clipping.
- Avoid relying on color alone for provider/security status.
- Keep focus rings visible against both paper and translucent surfaces.
- Mobile should show one primary hierarchy at a time with no horizontal scroll.

## Product Decision For This Iteration

The most important polish increment is security hardening around provider API keys. It directly reduces user risk and liability while preserving the local-first no-provider path that makes the product usable without keys.
