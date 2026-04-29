# trpg-gm-copilot

Chronicle GM is a local-first TRPG campaign assistant for human GMs. It helps turn session logs into reviewed campaign memory, while keeping AI output behind a GM approval flow.

## Current Features

- Plain log and speaker-segment log editors.
- Multiple local campaigns with search, switching, creation, duplication, deletion, and whole-library JSON backup.
- Rule-based extraction plus OpenAI/Ollama provider settings.
- GM review flow for extracted events, NPCs, clues, secrets, and threads, including candidate search and filtered bulk approval.
- Campaign memory view with search, clue status filtering, editable disclosure status, NPC attitude editing, and thread next-move editing.
- Dynamic next-session prep notes from approved campaign memory.
- Quick GM rescue prompts that can be appended into plain logs or speaker logs.
- Transcription provider settings scaffold with readiness checks, transcript confidence review indicators, low-confidence filtering, import preview, and sample/file-assisted draft JSON import/append/export for speaker logs.
- Local autosave, JSON export/import, session duplication, and API key storage outside campaign exports.

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
