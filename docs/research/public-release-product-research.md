# Public Release Product Research

Date: 2026-05-08

## Objective

Define the product, growth, UX, visual, accessibility, performance, and monetization principles that should guide Loreline from MVP to public release.

## Product Benchmarks

### Canva: simple, powerful, visual creation

Canva reported 260 million monthly users in 2025 and framed its growth around simple, powerful tools that help people communicate visually. It also described its AI product direction as moving users from idea to finished design quickly while respecting layout, hierarchy, and brand logic.

Implication for Loreline:

- Public Loreline must not look like an internal dashboard. It needs a strong visual identity and an immediately legible promise.
- AI should accelerate the GM's work from log to playable prep, not feel like a generic AI control panel.
- Generated visuals should communicate the fantasy/investigation craft of running games, while the app UI remains operationally quiet.

Source:

- https://www.canva.com/newsroom/news/canva-2025-wrap/

### Duolingo: habit, small wins, free entry

Duolingo's 2025 annual filing describes the product as fun, effective, and free. It reports 133.1M MAUs, 52.7M DAUs, and 12.2M paid subscribers for the three months ended December 31, 2025. It also emphasizes bite-sized lessons, streaks, personalization, and learn-by-doing as retention mechanisms.

Implication for Loreline:

- The first session must create one small win: import/sample log -> extract -> approve -> get next-session prep.
- Public Loreline needs a habit loop for post-session cleanup, not just a large feature set.
- Monetization should not block the first proof of value. A generous free/local tier can build trust.

Source:

- https://www.sec.gov/Archives/edgar/data/1562088/000162828026012494/duol-20251231.htm

### Linear: purpose-built speed and focus

Linear positions itself around purpose-built workflows, speed, reduced noise, and product operations that route work into actionable issues. Its method also stresses short specs, clarity, actual diffs as progress evidence, and customer feedback as a research library.

Implication for Loreline:

- The public release should be purpose-built for human GMs, not a generic AI notes app.
- The first viewport must reduce noise and restore momentum: "what happened last time, what matters now, what do I prep next?"
- Work should be broken into reviewable slices with a public-release task doc and visual verification evidence.

Sources:

- https://linear.app/
- https://linear.app/method/introduction

## Product-Led UX Standards

Material onboarding guidance says first-run experiences should be tied to specific user goals, should not show more marketing after installation, should help users understand how the app fits into their lives, and should drive retention actions in the first seven days. It recommends three models: self-select, quickstart, and top benefits.

Loreline should use a hybrid:

- Landing page: top benefits with strong visual identity.
- First app run: self-select only where it changes the experience, such as campaign style, tone, and starting material.
- Workbench: quickstart into the first key action.

Material also warns against blank states. Empty states should prevent confusion, use subtle imagery, and convey purpose. Loreline should replace generic empty panels with playable starter content and "do this next" actions.

Sources:

- https://m1.material.io/growth-communications/onboarding.html
- https://m1.material.io/patterns/empty-states.html

## Visual And Brand System Standards

Material color guidance supports using color schemes to match brand colors while testing accessibility. It frames primary color as the most frequent app color and secondary color as an accent for key UI parts.

Noto documentation confirms Noto Sans JP and Noto Serif JP are Japanese variants in the CJK family, with Noto Sans CJK available as a variable font. This makes Noto a safe base for Japanese public UI, but it should be paired with a more distinctive Latin/display voice if license and performance allow.

OpenAI's current GPT Image 2 model is described as a state-of-the-art image generation and editing model supporting text and image input and image output. Generated assets can be used for Loreline's background, onboarding scenes, icon concepts, and campaign-mode visual language, but app UI assets must be optimized, versioned, and accessible.

Sources:

- https://m1.material.io/style/color.html
- https://notofonts.github.io/noto-docs/website/use/
- https://developers.openai.com/api/docs/models/gpt-image-2

## Accessibility And Performance Standards

W3C WCAG 2.2 is the current W3C Recommendation and covers accessibility across devices. It is testable and improves usability for users generally. Public Loreline should target WCAG 2.2 AA, with manual keyboard, focus, target-size, label, status-message, and contrast checks.

Google's Core Web Vitals define current user-experience metrics around loading, interactivity, and visual stability. Recommended thresholds are LCP within 2.5s, INP 200ms or less, and CLS 0.1 or less, measured at the 75th percentile across mobile and desktop. Local lab checks are not a substitute for field measurement, but they are necessary before launch.

Sources:

- https://www.w3.org/TR/WCAG22/
- https://web.dev/articles/vitals?hl=en

## Monetization And Trust

Stripe's SaaS pricing guide emphasizes value-based pricing, simple transparent pricing, tiered/freemium options, and ongoing adaptation. Its usage-based billing docs list pay-as-you-go, flat fee plus overages, and credit burndown with top-ups as supported models.

Loreline should not monetize by weakening privacy. The public model should preserve local-first operation:

- Free: local campaigns, manual import/export, sample flow, limited provider diagnostics.
- Plus: hosted sync/backup, premium generated visual packs, convenience exports, larger QA/history limits, advanced transcription/extraction helpers.
- Pro/Creator: reusable campaign bible packs, table templates, advanced provider orchestration, team/collaboration if later validated.
- Usage: optional credits only for hosted AI/image/transcription features; user-owned provider keys remain supported.

Sources:

- https://stripe.com/en-jp/resources/more/saas-pricing-models-101
- https://docs.stripe.com/billing/subscriptions/usage-based/advanced/about

## Public Release Principles

1. **One memorable promise:** "Turn last session into next session."
2. **First win under five minutes:** A new user should see reviewed prep from a sample or pasted log without reading docs.
3. **Human GM sovereignty:** AI drafts; the GM approves; only approved memory persists.
4. **Visual signature:** Story-map backgrounds, mode-specific emblems, and handcrafted campaign motifs replace generic dashboard styling.
5. **Operational calm:** The workbench stays dense and scannable; visual richness lives in the landing, onboarding, empty states, and mode framing.
6. **Trust before growth:** Local-first, no hidden uploads, clear provider-key boundaries, redacted diagnostics, and player-safe exports.
7. **Habit loop:** Post-session cleanup, memory review, next-session prep, and player recap form a repeated loop.
8. **Accessible by default:** WCAG 2.2 AA is a launch gate, not a stretch goal.
9. **Performance as product quality:** No visually rich asset ships if it breaks mobile loading, input response, or layout stability.
10. **Monetize convenience, not lock-in:** Paid tiers add sync, hosted AI convenience, asset packs, and power workflows without trapping campaign data.

