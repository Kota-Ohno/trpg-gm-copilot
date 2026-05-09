# AGENTS.md

## Operating Standard

This repository is developed by a research-first, review-driven agent workflow. Treat quality as the primary objective. Optimize for the product outcome, not for minimizing agent effort, tokens, or elapsed time.

Use the full loop for any user-visible behavior change, UI change, dependency or tooling change, data model or persistence change, import/export change, AI/provider/prompt change, security/privacy-sensitive change, performance-sensitive change, build/test configuration change, or multi-file refactor. Exempt only typo-only edits, comment-only edits, and clearly mechanical formatting that cannot affect behavior.

For every full-loop change, run this process:

1. Research
   - Inspect the local codebase before proposing implementation.
   - Verify current external facts with primary or official sources when the task depends on APIs, libraries, tools, security, accessibility, browser behavior, regulations, pricing, or other time-sensitive information.
   - Record durable findings in Markdown under `docs/research/` or a task-specific doc under `docs/`.

2. Plan
   - Write a concrete plan with success criteria, affected files, verification commands, and user-visible risks.
   - Include macro-level product/architecture considerations and micro-level implementation/test considerations.
   - For substantial work, maintain a task doc under `docs/` with the plan, success criteria, review findings, decisions, replan iterations, and verification evidence. Use `docs/research/` for source-backed research notes.

3. Plan Review
   - Use SubAgents for independent plan review when available and permitted by the current runtime. This repository's standing preference is to use parallel reviewers for substantial work.
   - At minimum, cover product fit, technical design, security/privacy, UI/UX where relevant, test strategy, and maintainability.
   - Require reviewer output to include severity, evidence, affected files or behavior, and concrete remediation.
   - If SubAgents are unavailable, run the same review as documented independent passes by role, record why SubAgents were unavailable, and treat findings identically.
   - Revise the plan until material objections are resolved.

4. Implementation
   - Keep changes scoped to the accepted plan unless new evidence requires replanning.
   - Preserve existing user work. Do not revert unrelated changes.
   - Prefer existing project patterns over new abstractions.

5. Adversarial Review
   - Use SubAgents for multi-angle review when available and permitted.
   - Ask reviewers to look for regressions, hidden assumptions, security/privacy risks, accessibility problems, performance issues, test gaps, and product-quality failures.
   - Require reviewer output to include severity, evidence, affected files or behavior, and concrete remediation.
   - If SubAgents are unavailable, run and document role-based adversarial review passes in the task doc or final notes.
   - Document the disposition of every material finding: fixed, intentionally deferred with rationale, or blocked.
   - Treat unresolved material findings as blockers. Replan, patch, and repeat the review loop until findings converge.

6. Verification
   - Run the narrowest meaningful tests during iteration and `pnpm run check` before considering the task complete, unless impossible. In this repository `pnpm run check` includes tests and the production build.
   - For UI/UX work, start the app and inspect real rendered screens. Capture desktop and mobile evidence with the browser/in-app browser or an equivalent screenshot workflow. Also check keyboard-only flow, focus visibility, accessible names, touch target practicality, loading/empty/error/destructive states, and horizontal overflow. Do not judge UI quality from code alone.
   - For security/privacy-sensitive work, verify prompt payloads, local persistence, imports/exports, diagnostics, logs/errors, clipboard/download flows, screenshots, fixtures, and network calls do not leak provider secrets, campaign secrets, GM-only information, unrevealed clues, or user credentials.
   - For data-size-sensitive work, verify or reason against representative large campaigns/logs, avoid blocking render/input paths, watch bundle growth for new dependencies, and document known limits.

7. Commit
   - Commit at coherent milestones when the worktree state is suitable.
   - Stage only files belonging to the completed milestone. Do not include unrelated user changes.
   - Before every commit, review `git status --short` and `git diff --staged`; exclude secrets, generated noise, screenshots, build artifacts, and unrelated files.
   - Use concise commit messages that describe the product or engineering outcome.

## Project Context

- Product: つぎたく, a local-first TRPG campaign assistant for human GMs.
- Product boundary: support GM preparation, memory, review, and continuity. Do not turn the app into an AI GM replacement.
- Core safety rule: AI/provider output is a draft until the GM approves it. Only GM-approved information enters campaign memory.
- Privacy rule: campaign data, GM secrets, player-safe handouts, provider keys, diagnostics, and exports must preserve the existing separation between PL-known information, unrevealed clues, and GM-only secrets.

## Stack And Commands

- Runtime: Vite + React + TypeScript.
- Styling: Tailwind CSS with local shadcn/ui-like primitives.
- Icons: `lucide-react`.
- Install: `pnpm install`.
- Dev server: `pnpm run dev`.
- Tests: `pnpm run test`.
- Full local check: `pnpm run check`.
- Production build: `pnpm run build`.

## Code And Test Expectations

- Read the relevant implementation and tests before editing.
- Update or add focused tests for changed behavior.
- Keep TypeScript strictness intact and avoid weakening types to pass builds.
- Prefer structured parsers and typed data transformations over ad hoc string handling.
- Keep comments sparse and useful.
- Do not introduce new dependencies unless the research/plan explains why the existing stack is insufficient.

## UI/UX Expectations

- Build the actual usable workflow first, not a marketing page.
- Keep operational UI quiet, dense, and scannable. This is a GM workbench, not a decorative landing page.
- Use progressive disclosure for advanced, rare, destructive, provider, export/import, and QA controls.
- Mobile must show one hierarchy at a time and must not require horizontal scrolling.
- Text must not overlap, clip, or overflow its controls at desktop or mobile widths.
- Use icons for familiar tool actions when available, with accessible labels/tooltips where needed.
- Do not add decorative gradients, blobs, or ornamental cards that do not support the task.

## Review Gates

A task is not complete while any of these remain true:

- A material SubAgent review finding is unresolved.
- SubAgents were unavailable and the required role-based fallback review was not documented.
- `pnpm run check` fails and the failure is related to the task.
- UI changes have not been visually inspected in a real rendered viewport.
- UI changes have unverified keyboard, focus, accessible-label, state, or overflow behavior.
- Data export/import, diagnostics, prompts, persistence, logs, fixtures, clipboard/download, screenshot, network, or provider changes have unverified privacy behavior.
- Data-size-sensitive changes have unverified or undocumented performance behavior.
- Substantial work lacks a durable task doc or research/review/verification record.
- The implementation satisfies the literal request but misses the product intent.
