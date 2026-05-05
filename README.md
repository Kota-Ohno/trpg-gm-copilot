# trpg-gm-copilot

Chronicle GM is a local-first TRPG campaign assistant for human GMs. It helps turn session logs into reviewed campaign memory, while keeping AI output behind a GM approval flow.

## Current Features

- Plain log and speaker-segment log editors with speaker-line metrics, segment search, segment split/duplication, merge, text/timing normalization, log quality checks, issue export, review filters, and visible segment JSON export.
- Home dashboard with clickable KPI cards including session-list access, deep workflow links, filter-aware priority/provider alerts, visible main/side workspace breadcrumbs, persisted segmented left navigation and memory filters with a reset-to-default view control, direct memory-category shortcuts, focus mode, responsive segmented log/review/memory/prep workspaces, session-change routing back to log editing, and segmented side/settings panels that summarize session progress, review debt, campaign memory, priority alerts, next workflow actions, campaign/session management, log editing, transcription import, candidate inspection, bulk review management, category-focused memory browsing, focused next-session prep, live rescue prompts, and provider settings without forcing every control into one view.
- Multiple local campaigns with full session/detail/transcription search, transcription status filters, switching, creation, duplication, deletion, whole-library JSON backup, and library index Markdown export.
- Rule-based extraction plus OpenAI/Ollama provider settings.
- GM review flow for extracted events, NPCs, clues, secrets, and threads, including extraction-to-inspection routing, candidate search, invalid/duplicate-focused filters, filtered bulk approval/rejection, and visible-candidate JSON/Markdown export.
- Campaign memory view with search, clue status filtering, filtered JSON/Markdown export, editable disclosure status, NPC attitude editing, and thread next-move editing.
- Dynamic next-session prep notes from approved campaign memory, with prep-note Markdown/JSON export and full-session Markdown export from the prep view or session list.
- Quick GM rescue prompts that can be appended into plain logs or speaker logs.
- Transcription provider settings with readiness checks for manual/OpenAI/Web Speech, OpenAI audio-file transcription with file validation, transcription run history, transcript confidence and missing-timing metrics, low-confidence filtering, validated import preview, and sample/file-assisted draft JSON import/append/export for speaker logs.
- Local autosave, campaign/library/session JSON export/import, raw session JSON import, session duplication, and API key storage outside campaign exports.

## Development

```sh
npm install
npm run dev
```

Tests:

```sh
npm run test
```

Full local check:

```sh
npm run check
```

Production build:

```sh
npm run build
```

## Product Direction

The tool supports the GM rather than replacing them. AI/provider output is treated as a draft, and only GM-approved items enter campaign memory.
