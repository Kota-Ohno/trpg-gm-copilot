# trpg-gm-copilot

Chronicle GM is a local-first TRPG campaign assistant for human GMs. It helps turn session logs into reviewed campaign memory, while keeping AI output behind a GM approval flow.

## Current Features

- Plain log and speaker-segment log editors with speaker-line metrics, segment search, segment split/duplication, merge, text/timing normalization, log quality checks, review filters, and visible segment JSON export.
- Multiple local campaigns with full session/detail search, switching, creation, duplication, deletion, whole-library JSON backup, and library index Markdown export.
- Rule-based extraction plus OpenAI/Ollama provider settings.
- GM review flow for extracted events, NPCs, clues, secrets, and threads, including candidate search, filtered bulk approval/rejection, and visible-candidate JSON/Markdown export.
- Campaign memory view with search, clue status filtering, filtered JSON/Markdown export, editable disclosure status, NPC attitude editing, and thread next-move editing.
- Dynamic next-session prep notes from approved campaign memory, with prep-note Markdown/JSON export and full-session Markdown export from the prep view or session list.
- Quick GM rescue prompts that can be appended into plain logs or speaker logs.
- Transcription provider settings scaffold with readiness checks for manual/OpenAI/Web Speech, transcript confidence and missing-timing metrics, low-confidence filtering, validated import preview, and sample/file-assisted draft JSON import/append/export for speaker logs.
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
