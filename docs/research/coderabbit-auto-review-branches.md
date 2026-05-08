# CodeRabbit Auto Review Branch Configuration

Date: 2026-05-09

## Finding

CodeRabbit skips automatic reviews for pull requests whose base/target branch is not the repository default branch unless additional base branches are configured.

The repository default branch is `main`, while the long-lived review bases currently in use are `feature/public-release` and `feature/voice-transcription-research`. To allow automatic reviews on PRs targeting those release/research branches, add them to `reviews.auto_review.base_branches` in the root `.coderabbit.yaml`.

## Source

- CodeRabbit configuration reference, `reviews.auto_review.base_branches`: "Base branches (other than the default branch) to review. Accepts regex patterns. Use '.*' to match all branches. Defaults to []".
- CodeRabbit YAML configuration guide: `.coderabbit.yaml` must be located in the repository root, and configuration in the feature branch under review is detected by CodeRabbit.

## Plan Review

SubAgents were not used because the current runtime instructions only permit them when explicitly requested. Independent role review:

- Product fit: Explicitly enabling the release/research bases fixes skipped reviews without broadening reviews across every branch.
- Technical design: Root `.coderabbit.yaml` is the documented configuration location. The setting uses the documented `reviews.auto_review.base_branches` key.
- Security/privacy: No secrets or campaign data are introduced. The config only affects review routing.
- Test strategy: Validate YAML shape and run the repository full check to ensure the added config/documentation does not disturb the app.
- Maintainability: The branch list is intentionally narrow. Future long-lived base branches should be added here or represented with a carefully scoped regex.

## Verification Plan

- Parse `.coderabbit.yaml` with a YAML parser.
- Run `pnpm run check`.
- Trigger CodeRabbit on an existing PR with `@coderabbitai review` if immediate one-off review is needed; future pushes/PRs targeting `feature/public-release` or `feature/voice-transcription-research` should be auto-reviewed.

## Adversarial Review

SubAgents were not used because the current runtime instructions only permit them when explicitly requested. Independent role review:

- Regression risk: Adding a root `.coderabbit.yaml` changes CodeRabbit behavior only. It does not affect runtime code, builds, or tests.
- Hidden assumption: This enables automatic reviews for PRs whose base branch is `feature/public-release` or `feature/voice-transcription-research`. If another non-default base branch should also be reviewed, it must be added separately or covered by a scoped regex.
- Over-broad review scope: Avoided `.*` because reviewing all non-default branches can create noisy reviews on experimental branches.
- Configuration availability: Existing open PRs may need a new push or an explicit `@coderabbitai review` command for an immediate review. Future PRs should use this committed config.

## Verification Evidence

- `ruby -e 'require "yaml"; p YAML.load_file(".coderabbit.yaml")'` parsed the configuration successfully.
- `pnpm run check` passed:
  - Vitest: 12 test files passed, 128 tests passed.
  - Production build completed successfully.
