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

Comparative read:

| Product | Primary job-to-be-done | Strong pattern | Risk if copied directly | `つぎたく` adaptation |
| --- | --- | --- | --- | --- |
| World Anvil | Maintain a rich campaign/world bible across many entities. | Factions, timelines, player journeys, GM screen-style reference surfaces. | Becomes encyclopedia-first and asks too much blank-page work from a busy GM. | Keep world memory generated from sessions, then expose concise reference/prep surfaces. |
| Kanka | Organize RPG campaigns with characters, locations, quests, maps, calendars, timelines, and relations. | Reusable entity model, relationships, and quest element grouping. | Adds too many entity-management choices before the user has value. | Preserve mode-aware categories, but lead from log extraction and review instead of manual entity creation. |
| Obsidian | User-owned local knowledge base with linking, files, and optional sync. | Local-first ownership, backlinks/graph thinking, open files, privacy posture. | Generic notes app workflows would bury the table-session loop. | Keep local-first save/export and session-to-memory continuity; make sync/provider choices explicit and optional. |

### Top Productivity Workbenches

Notion and Obsidian show the value of user-owned content, fast capture, backlinks/structured organization, and templates. Linear shows the value of high-density command surfaces, keyboard-first affordances, status clarity, and low-noise prioritization.

Actionable takeaways:

- Reduce first-screen control inventory; expose the next action and priority risk first.
- Keep sidebar/details available, but make them scannable and calm.
- Prefer precise status labels over large explanatory text.
- Templates should start useful work immediately rather than explaining features.

Workbench pattern map:

| Product pattern | Evidence source | Useful element | Implemented/retained in this iteration |
| --- | --- | --- | --- |
| Linear-style work routing | Linear features/docs emphasize roadmap-to-release flow, issues/cycles, and clear product operations. | One command surface with next action, status, and risk rather than a spread of equal-weight controls. | Home `Session Command`, priority alerts, continuity queue, workflow detail, and richer visual hierarchy. |
| Notion database views | Notion help documents database views, filters, sorts, groups, and property visibility. | Dense data should be segmentable by view/filter without forcing every property onscreen. | Segmented workspaces, filters, session/campaign search, hidden details, and concise badges. |
| Obsidian local-first ownership | Obsidian docs position notes as local files/vaults, with optional sync and visible security posture. | Trust comes from clear storage boundaries and exports. | Local autosave/export remains primary; API keys are session-only and excluded from exports/diagnostics. |

Positioning conclusion:

`つぎたく` should be framed as a "session continuity workbench" rather than a campaign wiki. The feature moat is not having more object types; it is shortening the cognitive path from noisy play log to GM-approved continuity and next-session output.

## Security Findings

OpenAI's API-key safety guidance says keys should not be exposed in client-side code and should be stored outside source control and managed through secure environments. OWASP's secrets guidance similarly treats secrets as sensitive lifecycle-managed material that should not be casually stored, logged, or exposed.

Risk assessment for current architecture:

- This is a Vite static client app. Any browser-entered API key is inherently exposed to that browser context and extensions.
- Persisting an API key in `localStorage` increases risk because it survives reloads, browser restarts, and any later XSS.
- Export and diagnostics exclusion is necessary but not sufficient.

Decision:

- Do not persist provider API keys in browser storage.
- Clear the legacy provider-secrets storage key on app startup.
- Clear the legacy single-campaign storage key after saving the migrated campaign library, because older state shapes may contain legacy provider key fields.
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

Design decisions applied:

- Palette: kept teal/amber/violet as functional accents instead of a one-hue theme; darkened muted/destructive/primary tokens for stronger legibility and AA control contrast.
- Typography: kept Japanese UI stack with display serif reserved for the public entry hero; dense workbench text stays sans-serif.
- Radius/spacing: retained 8px or smaller rounding for operational cards/buttons; richer styling comes from surface depth and grouping rather than oversized rounded cards.
- Grouping: `Session Command`, priority alerts, continuity queue, and workflow detail now have distinct surface treatments so the user can scan action, risk, and context separately.
- Focus: public/workbench focus outline is explicit and not dependent on Tailwind ring defaults alone.

## Product Decision For This Iteration

The most important polish increment is security hardening around provider API keys. It directly reduces user risk and liability while preserving the local-first no-provider path that makes the product usable without keys.

## Implementation Trace

| Research decision | Code/docs artifact |
| --- | --- |
| Session-to-session continuity is the differentiator. | Home dashboard keeps `ログ -> 承認 -> 記憶 -> 次回準備`, continuity queue, and workflow details as the first workbench surface. |
| Client-side API keys must not persist. | `src/App.tsx` provider secrets load session defaults only, removes legacy provider-secret storage, and no longer imports legacy API keys from campaign JSON. |
| Legacy saved secrets need cleanup. | `src/App.tsx` removes `chronicle-gm.campaign-state.v1` after saving the migrated library format and removes `chronicle-gm.provider-secrets.v1` on startup. |
| Imported JSON must not smuggle secret fields forward. | `src/lib/campaign.ts` rebuilds normalized/exported campaign, session, live-log, extraction item, and run objects from allowlisted fields only; tests cover unknown `apiKey`/`providerSecrets` stripping. |
| Security boundary must be visible before key entry. | `src/components/provider-settings-card.tsx` says API keys are tab-only, not stored/exported, and disappear on reload; `security-boundary-note` visually groups the warning. |
| Diagnostics must not imply secret export. | `src/lib/diagnostics.ts` describes API keys as not browser-persisted and excluded from campaign/diagnostic JSON. |
| Normal workbench should feel richer without adding cognitive load. | `src/styles.css` adds controlled surface treatments for command, priority, queue, and workflow panels. |
