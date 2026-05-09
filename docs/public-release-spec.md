# つぎたく Public Release SPEC

Date: 2026-05-08
Branch: `feature/public-release`
Status: Implemented for PR review

## Goal

Transform the MVP into a public release that can credibly attract real GM users: visually distinctive, immediately understandable, trustworthy, useful in one sitting, accessible, performant, and monetizable without compromising local-first ownership.

## Success Criteria

- A first-time user understands つぎたく's value within 10 seconds of the public entry screen.
- A first-time user can complete the no-account/no-provider activation path in under 5 minutes: choose campaign style, use sample or pasted log, run local/sample extraction, approve memory, generate next-session prep.
- The app no longer reads as a generic CSS-library dashboard in the public-facing entry, onboarding, empty states, and key workbench surfaces.
- Visual assets are original or properly licensed, optimized, and useful. Generated imagery must support story, not decoration.
- The core workbench remains practical for repeated GM use: quiet, dense, scannable, keyboard-accessible, and mobile-safe.
- Local-first privacy boundaries remain explicit and intact.
- `pnpm run check` passes.
- Real rendered desktop and mobile UI are inspected for hierarchy, overflow, focus, accessible labels, touch target practicality, empty/loading/error/destructive states, and performance-risk regressions.
- SubAgent plan review and adversarial implementation review produce no unresolved material blockers.

## Measurement Plan

Activation and public-readiness claims must be verified by direct evidence:

- **10-second comprehension:** show the entry screen screenshot to at least one reviewer pass and require them to state what the product does, who it is for, and what the first action is. If the answer misses any of those three, the entry screen fails.
- **5-minute activation:** use a fresh browser profile and a stopwatch. The path must not require provider keys, account creation, reading README/docs, or manually constructing JSON.
- **Generic-dashboard test:** capture desktop and mobile screenshots and run adversarial review against: generic shadcn/Tailwind feel, unclear brand memory, decorative-only art, low information density, and visual clutter.
- **Privacy test:** inspect every activation action and provider/export/diagnostic path touched by the release to confirm when data remains local and when network calls happen.
- **Performance test:** before field data exists, use production build screenshots and browser/lab checks to enforce no horizontal overflow, no obvious layout shift, and asset budgets. After launch, evaluate Core Web Vitals field data when available.

## Target Users

- Primary: human TRPG GMs who run ongoing campaigns and hate post-session continuity cleanup.
- Secondary: actual-play organizers, mystery/fantasy campaign writers, and GMs who need player-safe recaps.
- Non-target: players looking for an AI GM, users who want cloud-only campaign automation, and groups that do not want to review AI output.

## Launch Locale

Initial public release is Japanese-first with English-safe brand/tagline support:

- Japanese is the product UI and onboarding default.
- English tagline/brand copy may appear as accent text only where it improves memorability.
- All generated image prompts and asset manifests must include Japanese UI constraints where text appears; prefer no embedded text in generated images to avoid unreadable or mistranslated copy.

## Positioning

Tagline direction:

- Primary: `Turn last session into next session.`
- Japanese: `前回のログを、次回の卓へ。`

Promise:

- つぎたく turns messy session logs into approved campaign memory, next-session prep, and player-safe recaps while keeping the GM in control.

Category:

- GM continuity studio, not chatbot, not VTT, not generic notes.

## Product Shape

### Public Entry

The app should open with a real product experience, not a static marketing page. The first viewport combines:

- Brand mark and promise.
- One generated/illustrated story-map background that signals tabletop campaign craft.
- Three concrete benefits: `ログから記憶`, `次回準備`, `プレイヤー共有`.
- Primary CTA: start with sample campaign.
- Secondary CTA: paste/import own log.
- Trust strip: local-first, GM-approved memory, player-safe exports.

Returning users with existing local campaigns should bypass marketing-style onboarding and land in the workbench, with a small release-note affordance rather than a blocking welcome screen.

### First-Run Activation

Use a short self-select flow only where choices materially change the first session:

- Campaign mode: investigation / fantasy / custom.
- Tone: grounded / heroic / eerie / comedic.
- Start source: sample log / paste log / import file.

Then land directly in the workbench with the next key action highlighted.

### Visual Identity

Brand direction:

- `つぎたく` should feel like a campaign cartographer, continuity archivist, and table-side producer.
- Avoid generic SaaS blue-purple gradients, beige fantasy parchment clichés, and dark slate dashboards.
- Use a balanced palette: ink, sea-glass, signal amber, paper, and one vivid story accent per campaign mode.

Assets:

- Generate a hero/background image: an overhead GM desk where a campaign map, sticky clue threads, dice, and glowing log fragments converge into a clean next-session route.
- Generate mode emblems:
  - Investigation: compass lens, thread pins, coastal/night clue language.
  - Fantasy: lantern, route sigil, campaign chronicle.
  - Custom: blank constellation map.
- Generate empty-state illustrations for no log, no candidates, no approved memory, no prep.
- Store final assets under `src/assets/public-release/`.
- Maintain `src/assets/public-release/manifest.json` with prompt, model/tool, generation date, source/ownership note, dimensions, optimized file size, alt text, decorative/non-decorative classification, and intended UI location.
- Asset budget: public-entry hero/background target <= 350 KB after optimization; each emblem/empty-state target <= 120 KB. Any exception requires a documented visual value and performance review.

Typography:

- Japanese UI base: `Noto Sans JP` or a local/system fallback stack with strong line-height discipline.
- Japanese display accent: evaluate `Noto Serif JP` for sparse headings or campaign flavor only.
- Latin display can be more distinctive, but must not harm Japanese legibility or load performance.
- Font loading must avoid layout shift; no large remote font payload without fallback metrics and performance verification.

### Workbench Refinement

Public release does not remove MVP functionality. It changes hierarchy:

- Home becomes a command center with one dominant next action.
- Advanced provider, QA, import/export, and diagnostic controls stay discoverable but not first-scan dominant.
- Session/campaign sidebars remain compact and scannable.
- Review flow emphasizes "draft -> GM decision -> memory" as the product's core safety model.
- Prep flow emphasizes "ready for next table" with player-safe output clearly separated from GM-only notes.

### Trust And Privacy

Hard requirements:

- No campaign content upload unless the user explicitly invokes a provider, transcription, hosted backup, or sync action.
- Provider keys remain separated from campaign exports.
- Diagnostics and QA exports remain redacted.
- Player-safe exports must continue blocking unrevealed clues and GM secrets.
- Public copy must never imply AI decisions become canon automatically.
- Public activation must work without user-owned API keys and without sending campaign text to any external service.
- Generated release artwork must not include private campaign content unless the user explicitly asks to generate personal campaign art in a future feature. Initial release assets are generic product assets.

### Monetization

Initial public release ships without live billing, accounts, hosted sync, or payment code. The UX/spec must be pricing-ready without creating a backend dependency in this branch.

Recommended model:

- Free/local: core local campaigns, sample activation, manual import/export, player-safe exports, user-owned provider keys.
- Plus: hosted backup/sync, premium visual themes, convenience export bundles, larger QA history, hosted transcription/extraction credits.
- Creator/Pro later: campaign bible templates, collaboration, table handoff packs, reusable scenario systems.

Principle:

- Charge for convenience, hosted compute, sync, and premium presentation. Never charge to unlock a user's local campaign data.

Out of scope for this branch:

- Stripe integration.
- User accounts.
- Hosted campaign storage.
- Team collaboration.
- Real usage-metered AI credits.

These may be designed as future capabilities, but the public UI must not advertise them as available.

## Technical Implementation Constraints

- Keep Vite + React + TypeScript and the existing local-first state model for this branch.
- Do not add a component framework or animation dependency unless the SPEC is amended with research, bundle impact, and verification.
- Prefer CSS tokens and existing primitives over replacing the UI stack.
- Keep generated and bitmap assets optimized and committed only if they are production assets. Do not commit raw prompt experiments, screenshots, or build output.
- First-run state must be persisted in the existing UI preference/local storage pattern and must not corrupt existing MVP user data.
- Public-release changes should be committed by milestone: docs/spec, assets/tokens, entry/activation, workbench polish, launch readiness.

## Accessibility And Motion Requirements

- Target WCAG 2.2 AA for public release.
- Every non-decorative image needs useful alt text; decorative imagery must be hidden from assistive tech.
- Focus indicators must remain visible on public entry, onboarding, and workbench controls.
- Touch targets should be at least 24 x 24 CSS px, with larger practical targets for primary mobile CTAs.
- Generated backgrounds must never reduce text contrast below AA thresholds.
- Respect `prefers-reduced-motion`; any animated or parallax-like treatment must have a static equivalent.
- Dynamic extraction/import/activation status must be conveyed with accessible status text, not color alone.

## Milestones

### M1: Public Release SPEC And Review

Deliverables:

- `docs/research/public-release-product-research.md`
- `docs/public-release-spec.md`
- SubAgent plan review findings and disposition in this spec.

Verification:

- Sources are cited.
- Scope is concrete enough to implement.
- Reviewers find no unresolved material blocker in positioning, UX, privacy, technical scope, or launch criteria.

### M2: Brand System And Assets

Deliverables:

- Public palette, typography tokens, spacing/radius rules, and motion rules in CSS.
- Generated hero/background image and mode emblem assets under a repo asset path.
- Asset manifest with prompt, generation date, license/ownership note, dimensions, optimized file size, and alt/usage guidance.

Verification:

- Contrast checks against WCAG 2.2 AA for text and UI controls.
- Asset file sizes and dimensions documented.
- Desktop/mobile screenshots show no clutter, overlap, or generic library feel.
- Manifest entries exist for every generated or imported public-release asset.

### M3: Public Entry And Activation

Deliverables:

- Public entry/first-run surface in the app.
- Sample campaign activation path.
- Paste/import activation path.
- Empty states replaced with useful illustrated states and next actions.

Verification:

- Activation can be completed manually in under 5 minutes.
- No provider key, account, or external network call is needed for the sample activation path.
- Keyboard-only path works.
- No horizontal overflow at mobile widths.
- `pnpm run check` passes.

### M4: Workbench Public Polish

Deliverables:

- Refined command center, review, memory, prep, and side desk hierarchy.
- Mode-specific visual framing without reducing operational density.
- Loading/error/destructive states polished and accessible.

Verification:

- Real rendered screenshots for desktop and mobile.
- Focus, labels, target sizes, and status messages checked.
- Privacy checks for provider/export/diagnostic boundaries.

### M5: Launch Readiness

Deliverables:

- README and manual verification guidance updated for public release.
- Pricing-ready copy and plan boundaries documented.
- Changelog/release notes.
- Final PR from `feature/public-release`.

Verification:

- `pnpm run check`.
- Production build inspected.
- SubAgent adversarial review loop converged.
- Completion audit maps every user requirement to evidence.

## Review Log

### Plan Review 1

Status: completed with fallback review.

Requested reviewer lenses:

- Product-market and activation.
- Visual/brand and UI quality.
- Technical implementation and performance.
- Privacy/security and monetization trust.

Findings:

- New SubAgent spawn attempts failed due the active thread limit. Existing SubAgent threads accepted messages but returned no usable findings. Per `AGENTS.md`, the review was completed as documented role-based fallback passes rather than skipped.
- **High: Activation depended on unspecified provider behavior.** The previous success criteria said users extract candidates in under five minutes but did not state that this must work without API keys or external services. Public activation now explicitly uses a no-account/no-provider local or sample path.
- **High: Monetization scope could create backend creep.** The previous pricing section mentioned sync, credits, and hosted backup without declaring them out of scope for this branch. The spec now states public release ships without billing, accounts, hosted storage, or payment code.
- **High: Visual assets lacked production gates.** The previous asset plan did not define paths, manifest fields, file-size budgets, alt/decorative classification, or generated-text constraints. The spec now requires an asset manifest and file-size budgets under `src/assets/public-release/`.
- **Medium: Public entry could block returning users.** The previous entry requirement could force a marketing-style screen on existing local users. Returning users now bypass onboarding and land in the workbench.
- **Medium: Success metrics were underdefined.** The previous 10-second comprehension and five-minute activation claims had no measurement protocol. A measurement plan now defines reviewer comprehension, stopwatch activation, privacy, visual, and performance checks.
- **Medium: Accessibility omitted motion and image semantics.** The previous spec named WCAG but did not cover decorative image handling, reduced motion, generated backgrounds, or status messaging. Accessibility and motion requirements now cover those gates.
- **Medium: Launch language was ambiguous.** The previous spec mixed Japanese and English copy without declaring locale. The launch is now Japanese-first with English brand accents.

Disposition:

- All material Plan Review 1 findings have been incorporated into this SPEC before implementation starts.

### Implementation Review 1

Status: completed with role-based adversarial review fallback.

Evidence inspected:

- Commits: `250916a feat: add public release entry experience`, `eb10e7d feat: illustrate public empty states`, `30af173 chore: expand public readiness guidance`.
- Verification command: `pnpm run check` passed with 128 tests and production build.
- Rendered screenshots inspected with local Chrome headless:
  - Desktop public entry at 1440 x 1100: `/tmp/tsugitaku-entry-desktop-3.png`.
  - Mobile public entry at 390 x 844: `/tmp/tsugitaku-entry-mobile-6.png`.
- Asset budget output from production build:
  - Hero: 331.14 KB.
  - Mode emblems: 73.08 KB, 87.77 KB, 93.59 KB.
  - Empty states: 63.31 KB, 68.22 KB, 69.55 KB, 80.52 KB.

Findings:

- **High: Public-readiness verification did not cover public-release-specific claims.** Manual verification guidance now covers 10-second comprehension, no-provider activation, image manifest budgets, and privacy/network boundaries without shipping a dedicated release checklist UI.
- **Medium: Mobile public entry initially clipped the skip button and card text.** The narrow layout now hides the secondary button label and simplifies mode-card copy below compact widths; mobile screenshot inspection confirmed no visible text clipping in the first viewport.
- **Medium: Empty states were still generic text panels.** Home, review, memory, and prep empty states now use optimized generated illustrations with useful alt text and next actions.
- **Medium: Asset ownership evidence was incomplete for new empty-state images.** `src/assets/public-release/manifest.json` now includes source path, prompt, dimensions, optimized bytes, budget, alt text, classification, and intended use for every public-release image.
- **Low: TypeScript needed Vite asset import declarations.** `src/vite-env.d.ts` was added so committed bitmap assets can be imported safely.

Disposition:

- All Implementation Review 1 findings were addressed before PR preparation.
