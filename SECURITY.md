# Security Policy

## Supported Versions

The public release branch and the latest deployed static build are the only supported targets during the initial release phase.

## Reporting A Vulnerability

Report security issues through GitHub private vulnerability reporting if it is enabled for this repository. If that is unavailable, open a minimal public issue that says a private security report is needed, but do not include secrets, exploit details, API keys, campaign logs, player personal data, or GM-only material.

Expected initial response target: best effort within 7 days.

## Sensitive Data Rules

- Do not include real provider API keys in issues, pull requests, screenshots, logs, diagnostics, or exported sample files.
- Do not post private campaign logs, safety-tool notes, unrevealed clues, or player personal data publicly.
- If a key may have been exposed, revoke it at the provider immediately.

## Current Security Boundary

`つぎたく` is a static, browser-side app. Provider keys are kept only in active tab state and are not persisted by the app, but browser extensions, compromised devices, malicious injected scripts, or a modified deployment can still access page state. A future hosted/pro architecture should use a server-side or local proxy if stronger API-key isolation is required.
