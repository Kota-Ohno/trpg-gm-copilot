# つぎたく frontend restructure plan

## Success criteria

- The first desktop viewport shows one primary workbench, not a three-panel cockpit.
- The default state exposes the next action, core metrics, priority risks, and primary workspace navigation only.
- Management actions remain available but are not visible by default.
- Mobile width does not require horizontal scrolling and shows one hierarchy at a time.
- The implementation keeps existing workflows and tests green.

## Plan

1. **Shell simplification**
   - Change the app shell from left/main/right to left/main with the side desk below the main workbench.
   - Keep the side desk accessible, but remove it from the first desktop scan path.

2. **Progressive disclosure**
   - Keep `Campaign Setup`, `Export / Import`, and `ワークフロー詳細` collapsed by default.
   - Keep Provider and operational controls behind the side desk’s `運用` tab.

3. **Action hierarchy**
   - Preserve the top toolbar for `抽出`, `出力`, and `集中`.
   - Keep workspace tabs for navigation only.

4. **Risk hierarchy**
   - Use amber non-blocking priority cards instead of destructive red buttons for routine incomplete states.
   - Keep destructive styling only for genuinely destructive actions or hard blockers.

5. **Verification loop**
   - Run `pnpm run check`.
   - Capture desktop and mobile screenshots with Chrome.
   - Adversarially review screenshots for clutter, ambiguous labels, crowding, horizontal overflow, and first-viewport confusion.
   - Patch issues and repeat until no material issues remain.

## Self-review before implementation

- Risk: Moving side desk below main may increase distance to quick prompts.
  - Decision: This is acceptable because quick prompts are secondary. The main task should win the first viewport.
- Risk: Collapsing setup/export could reduce discoverability.
  - Decision: The labels remain visible, and these actions are not primary session-running tasks.
- Risk: Tests do not prove visual quality.
  - Decision: Use browser screenshots as direct visual evidence in addition to tests.

## Implementation and adversarial review log

### Loop 1

Evidence:

- `pnpm run check` passed.
- Desktop screenshot: `/private/tmp/tsugitaku-redesign-desktop-1.png`
- Mobile screenshot: `/private/tmp/tsugitaku-redesign-mobile-1.png`

Adversarial findings:

- Desktop improved because the permanent right rail no longer competes with the workbench.
- Mobile still failed the objective: campaign navigation appeared before the current task, forcing users to scroll before seeing what to do.

Fix:

- Reordered layout on compact screens: main workbench first, campaign navigation second, side desk third.

### Loop 2

Evidence:

- `pnpm run check` passed.
- Mobile screenshot: `/private/tmp/tsugitaku-redesign-mobile-2.png`

Adversarial findings:

- Main workbench now appears first on mobile.
- Session/date/reset controls were still horizontally crowded.

Fix:

- Mobile controls now stack vertically.
- Main recommended action button uses full width on compact screens.
- Shared button styles now cap width.

### Loop 3

Evidence:

- `pnpm run check` passed.
- Mobile screenshot: `/private/tmp/tsugitaku-redesign-mobile-3.png`
- Mobile screenshot after width simplification: `/private/tmp/tsugitaku-redesign-mobile-4.png`
- Scale-fixed mobile screenshot: `/private/tmp/tsugitaku-redesign-mobile-4-scale1.png`

Adversarial findings:

- Mobile first task is visible immediately.
- Management navigation is no longer in the initial mobile viewport.
- Remaining screenshot edge clipping appears tied to Chrome headless scaling behavior; wide capture confirms the responsive layout is contained.

Fix:

- Removed fragile `calc(100vw - 2rem)` width control and used parent-width containment.

Current status:

- No remaining material findings against the explicit goals: lower cognitive load, less visible complexity, less required scrolling to find the primary task, and preserved access to advanced functions through progressive disclosure.
