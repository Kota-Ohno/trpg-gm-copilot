# Loreline Public Release Notes

Date: 2026-05-08
Branch: `feature/public-release`

## What Changed

- Added a public first-run entry with generated tabletop campaign artwork, mode cards, and no-account/no-provider starting paths.
- Added generated public-release assets for hero, campaign modes, and empty states, all tracked in `src/assets/public-release/manifest.json`.
- Replaced generic empty panels in the log, review, memory, and prep loops with illustrated, action-oriented states.
- Updated the visual foundation with public palette, Japanese-first font stacks, display typography, compact mobile behavior, and reduced-motion handling.
- Expanded Release QA to cover public-specific gates: 10-second comprehension, 5-minute provider-free activation, image manifest/budgets, responsive screenshots, and privacy/network boundaries.
- Kept monetization pricing-ready but out of scope for this branch: no billing, accounts, hosted storage, sync, or payment code.

## Verification

- `npm run check` passed: 128 tests plus production build.
- Production build asset output confirmed budgets:
  - `loreline-hero.jpg`: 331.14 KB, target <= 350 KB.
  - Mode emblems: 73.08-93.59 KB, target <= 120 KB each.
  - Empty-state images: 63.31-80.52 KB, target <= 120 KB each.
- Desktop public-entry screenshot inspected at 1440 x 1100.
- Mobile public-entry screenshot inspected at 390 x 844.

## Release Boundaries

- Campaign content remains local unless the GM explicitly invokes a provider, transcription endpoint, hosted backup, or future sync action.
- Provider keys remain outside campaign/library/session exports.
- AI/provider output remains draft material until GM approval.
- Player-safe exports continue to block unrevealed clues and GM-only secrets.
- The public branch does not ship Stripe, user accounts, hosted campaign storage, team collaboration, or bundled AI credits.
