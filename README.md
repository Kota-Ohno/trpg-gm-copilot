# つぎたく

つぎたくは、人間のGMが運営するTRPGキャンペーン向けのローカルファーストな支援ツールです。セッションログを、GMが確認したキャンペーン記憶と次回準備へつなげます。

## Market Position

つぎたくはAI GMではありません。人間主導の卓を続けるGMが、卓後の整理を減らし、次回の再開を楽にするための作業台です。

Differentiators:

- Separates PL-known information from GM secrets and unrevealed hooks.
- Treats AI/provider output as a draft until the GM approves it.
- Connects session logs, reviewed memory, next-session prep, player-safe handouts, and wrap-up notes in one loop.
- Stays local-first with user-owned provider keys and exportable campaign data.
- Supports both investigation scenarios and fantasy campaigns through mode-specific labels and starter templates.

## Current Features

- First-run flow: pick an investigation or fantasy starter, inspect the continuity queue, run extraction, approve only GM-vetted memory, then export next-session prep or a player-safe handout.
- Plain log and speaker-segment log editors with speaker-line metrics, segment search, segment split/duplication, merge, text/timing normalization, log quality checks, issue export, review filters, and visible segment JSON export.
- Home dashboard with clickable KPI cards including session-list access, deep workflow links, continuity queue recommendations including player-handout safety warnings, filter-aware priority/provider/storage/review-quality alerts, visible main/side workspace breadcrumbs, persisted segmented left navigation and memory filters with a reset-to-default view control, direct memory-category shortcuts, focus mode, responsive segmented log/review/memory/prep workspaces, session-change routing back to log editing, and segmented side/settings panels that summarize session progress, review debt, campaign memory, priority alerts, next workflow actions, campaign/session management, starter campaign creation, log editing, transcription import, candidate inspection, bulk review management, category-focused memory browsing, focused next-session prep, player-safe handout preview, live rescue prompts, and provider settings without forcing every control into one view.
- Multiple local campaigns with investigation/fantasy starter templates, full session/detail/transcription search, transcription/archive status filters, risk/size-aware campaign summaries, session sorting by recency/size/review debt/title, switching, creation, duplication, archiving, deletion, export-then-archive cleanup, whole-library JSON backup, and library index Markdown export with next-action cues.
- Campaign mode settings for investigation and fantasy play styles, feeding mode-specific guidance into LLM extraction prompts, rule-based extraction, quick rescue prompts, memory labels, and next-session prep labels.
- Rule-based extraction plus OpenAI/Ollama provider settings, provider readiness checks, extraction prompt-size visibility, and oversized prompt alerts before API use.
- GM review flow for extracted events, NPCs, clues, secrets, and threads, including extraction-to-inspection routing, candidate search/sorting, invalid/duplicate-focused filters, visible memory-impact preview, undo for rejected candidates, filtered bulk approval/rejection, and visible-candidate JSON/Markdown export.
- Campaign memory view with search, mode-aware labels, clue/status filtering, filtered JSON/Markdown export, editable disclosure status, NPC attitude editing, and thread next-move editing.
- Dynamic next-session prep notes from approved campaign memory with mode-aware labels and fallback text, session wrap-up checklist that reflects blocked player-handout status, wrap-up Markdown export/copy with player-handout safety status, prep-note Markdown/JSON export, player-safe handout preview/export/copy that excludes GM secrets and unrevealed clues, handout leak warnings and blocked share actions for secret-derived text, and full-session Markdown export from the prep view or session list.
- Quick GM rescue prompts that can be appended into plain logs or speaker logs.
- Transcription provider settings with readiness checks for manual/OpenAI/Web Speech, OpenAI audio-file transcription with file validation, transcription run history, transcript confidence and missing-timing metrics, low-confidence filtering, validated import preview, and sample/file-assisted draft JSON import/append/export for speaker logs.
- Local autosave with storage-size visibility, largest-session size diagnostics, review-quality diagnostics, backup freshness reminders, in-app trust/safety checks, support diagnostics export with product-safety status, campaign/library/session JSON export/import with import-impact previews and oversized-file guards, raw session JSON import, session duplication, and API keys kept session-only outside browser persistence and exports.

## Development

```sh
pnpm install
pnpm run dev
```

Tests:

```sh
pnpm run test
```

Full local check:

```sh
pnpm run check
```

Production build:

```sh
pnpm run build
```

Operational checks:

- Run `pnpm run check`.
- Open the local app in a fresh browser profile and verify the public entry, 10-second comprehension, starter creation, extraction, review approval, memory, prep, player handout, wrap-up, export/import, and settings panels.
- Complete the sample or pasted-log activation path without API keys, account creation, or external campaign-text upload.
- Verify `src/assets/public-release/manifest.json` covers every committed public-release image and that the hero stays under 350KB while each emblem/empty-state image stays under 120KB.
- Verify desktop and narrow mobile widths for the public entry, empty states, and workbench surfaces; check overlapping text, unusable controls, focus visibility, and horizontal scrolling.
- Test extraction and transcription providers separately from their connection-test buttons, only with a user-owned API key or local endpoint.

## Product Direction

The tool supports the GM rather than replacing them. AI/provider output is treated as a draft, and only GM-approved items enter campaign memory.

Service naming rationale and alternatives are tracked in `docs/brand-naming-review.md`.
