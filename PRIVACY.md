# Privacy Notice

Last updated: 2026-05-09

`つぎたく` is a local-first TRPG GM workbench. The public static app does not require an account and does not provide a hosted backend for campaign data.

## What The App Stores

- Campaigns, sessions, approved memory, draft notes, UI preferences, and backup timestamps are stored in the browser on the user's device.
- Provider API keys are held only in the active browser tab state. They are not written to browser storage, exports, diagnostics, or campaign JSON.
- Users can export campaign data as JSON or Markdown. Those files are created locally by the browser.

## What Leaves The Device

By default, campaign content stays in the browser. Content leaves the device only when the user chooses a provider or endpoint that sends data over the network:

- OpenAI extraction sends the selected session log and extraction prompt to the configured OpenAI endpoint.
- OpenAI transcription uploads the selected audio file to the configured OpenAI endpoint.
- Ollama extraction sends the selected prompt to the configured local or custom Ollama endpoint.
- Browser speech recognition, when available, is provided by the user's browser and platform.

Provider calls are user-initiated and use the user's own provider key or endpoint. Review the selected provider's privacy and data-use terms before sending session logs, audio, GM secrets, or player information.

## Static Hosting Logs

If the app is hosted on Cloudflare Pages or another static host, the hosting provider may process request metadata such as IP address, user agent, request path, timestamp, and basic security telemetry. `つぎたく` should launch without advertising, analytics pixels, or tracking cookies unless this notice is updated.

## Sensitive Table Content

TRPG campaign notes can include player names, private preferences, unrevealed clues, character secrets, safety-tool notes, and GM-only material. Do not paste or upload content unless you have permission from your table and understand which provider will receive it.

## Contact

Use the repository issue tracker for non-sensitive privacy questions. Do not post API keys, campaign secrets, player personal data, or private logs in public issues.
