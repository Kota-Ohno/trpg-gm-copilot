# trpg-gm-copilot

Chronicle GM is a local-first TRPG campaign assistant for human GMs. It helps turn session logs into reviewed campaign memory, while keeping AI output behind a GM approval flow.

## Current Features

- Plain log and speaker-segment log editors.
- Multiple local campaigns with search, switching, creation, deletion, and whole-library JSON backup.
- Rule-based extraction plus OpenAI/Ollama provider settings.
- GM review flow for extracted events, NPCs, clues, secrets, and threads.
- Campaign memory view with search, clue status filtering, and editable disclosure status.
- Dynamic next-session prep notes from approved campaign memory.
- Local autosave, JSON export/import, and API key storage outside campaign exports.

## Development

```sh
npm install
npm run dev
```

Production build:

```sh
npm run build
```

## Product Direction

The tool supports the GM rather than replacing them. AI/provider output is treated as a draft, and only GM-approved items enter campaign memory.
