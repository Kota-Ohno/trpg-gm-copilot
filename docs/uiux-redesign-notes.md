# つぎたく UI/UX redesign notes

## Objective

Reduce cognitive load for a feature-rich TRPG GM workspace. The default screen must answer:

1. What campaign/session am I in?
2. What should I do next?
3. What is blocking progress?
4. Where do I go for the main workflow?

Everything else is secondary and should be revealed only when the user asks for it.

## Research synthesis

- Progressive disclosure is the central pattern for this product. Show essential controls first and reveal advanced or rare actions on demand. This is especially important because つぎたく has many power-user features: exports, provider checks, templates, storage diagnostics, and detailed review management.
- Material responsive guidance says compact layouts should usually show a single level of content hierarchy, while wider layouts can show more than one level. つぎたく should not force left navigation, main dashboard, and live side tools into the same first viewport on small screens.
- Apple HIG emphasizes hierarchy, consistency, and accessibility. For cognition specifically, it recommends simple, familiar, consistent interactions and minimizing complexity.
- Apple tab guidance treats tabs as navigation, not actions. つぎたく should keep workspace tabs for destination switching and place extraction/export/focus commands in a toolbar.
- Material/SAP navigation rail guidance fits medium and large screens, but compact screens should not use a rail as a permanent panel. On mobile, the app should stack summary first and reveal secondary panels later.
- Dashboard guidance consistently points to simplicity, clear hierarchy, actionability, and limiting visible metrics. If a metric does not help the user decide what to do, it should not be prominent.

## Design principles for つぎたく

1. **One primary task per viewport.** The first viewport should be the current session command surface, not a full control inventory.
2. **Summary first, details on demand.** Campaign setup, export/import, workflow explanation, provider settings, and operational checks should be collapsed or moved behind explicit navigation.
3. **Navigation is not action.** Tabs switch workspaces; toolbar buttons perform actions.
4. **Reduce simultaneous panels.** Permanent right-side tools create a three-column cockpit that feels powerful but expensive to parse. Side tools should be secondary.
5. **Use risk without alarm fatigue.** Warnings should be prioritized and calm unless they block the next action.
6. **Mobile shows one hierarchy.** At compact widths, show campaign identity, workspace controls, and the current task. Side tools and management controls should come later.
7. **Labels must answer outcomes.** Prefer “次にやること: 抽出プレビューを実行” over generic labels like “候補” or “補助”.
8. **Keep repeated actions stable.** Main actions should stay in consistent toolbar positions to reduce relearning.

## Current app problems observed

- The first viewport still exposes navigation, campaign setup, export/import, session command, risk queue, workflow detail, and side desk in close proximity on desktop.
- The permanent right side desk competes with the core workflow and makes the app look like three apps at once.
- Warnings were too visually dominant when rendered as destructive red buttons; this made normal incomplete operational checks feel like emergency failure.
- Campaign setup and export/import are not daily workflow controls but were previously visible by default.
- Mobile still shows a lot before the user reaches the main task, so the above-the-fold experience should stay focused and stacked.

## Applied redesign direction

- Keep left navigation, but make setup/export collapsed by default.
- Make the center command surface the primary product experience.
- Move side desk out of the permanent first-row desktop layout, so it becomes a secondary panel below the main workbench.
- Collapse workflow education by default.
- Use amber priority cards for non-blocking risks instead of red destructive controls.
- Preserve all existing functionality; reduce initial exposure rather than deleting capabilities.

## Sources

- Material Design responsive layout: https://m1.material.io/layout/responsive-ui.html
- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/
- Apple Accessibility, Cognitive guidance: https://developer.apple.com/design/human-interface-guidelines/accessibility/
- Apple Tab Bars: https://developer.apple.com/design/human-interface-guidelines/tab-bars
- SAP/Material 3 navigation rail usage: https://www.sap.com/design-system/fiori-design-android/v25-8/components/m3-standard-components/navigation-rail/usage
- Dashboard design best practices, TechTarget: https://www.techtarget.com/searchbusinessanalytics/tip/Good-dashboard-design-8-tips-and-best-practices-for-BI-teams
- Progressive disclosure overview: https://uxuiprinciples.com/en/principles/progressive-disclosure
