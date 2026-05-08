# Agent Development Workflow Research

Date: 2026-05-08

## Objective

Define a durable development policy for this repository that guides Codex-like agents toward high-quality, research-first, review-driven work. The policy should be operational, not a verbatim transcript of a user preference.

## Sources Checked

| Source | Accessed | Relevant claim | Policy implication |
| --- | --- | --- | --- |
| OpenAI Codex AGENTS.md guide: https://developers.openai.com/codex/guides/agents-md | 2026-05-08 | Codex discovers instruction files by checking `AGENTS.override.md`, `AGENTS.md`, and configured fallback names from the project root to the current directory. | Use root `AGENTS.md` as the primary durable instruction artifact. |
| OpenAI Codex Subagents concept guide: https://developers.openai.com/codex/concepts/subagents | 2026-05-08 | Subagents are useful for parallel exploration, testing, triage, and summarization; write-heavy parallel work needs care. It also says Codex should only spawn subagents when explicitly asked for subagents or parallel work. | Prefer SubAgents for plan review and adversarial review, but include a fallback when the runtime does not permit spawning. |
| AGENTS.md open format repository: https://github.com/agentsmd/agents.md | 2026-05-08 | AGENTS.md is a predictable agent-facing README for project commands, tests, and conventions. | Keep `AGENTS.md` concise, operational, and repository-specific. |
| Galster et al., "Configuring Agentic AI Coding Tools: An Exploratory Study", arXiv:2602.14690, revised 2026-04-09: https://arxiv.org/abs/2602.14690 | 2026-05-08 | Context files are the dominant configuration mechanism across agentic coding tools; Skills and Subagents are less broadly adopted. | Use a root context file as the baseline and avoid relying solely on custom advanced mechanisms. |
| Lulla et al., "On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents", arXiv:2601.20404, revised 2026-03-30: https://arxiv.org/abs/2601.20404 | 2026-05-08 | In their sample, AGENTS.md presence was associated with reduced median runtime and output token use while maintaining comparable task completion behavior. | A focused `AGENTS.md` can improve future agent efficiency without lowering quality. |

## Findings

### AGENTS.md is the right primary artifact

OpenAI's Codex documentation says Codex discovers project instructions by walking from the project root to the current working directory and checking for `AGENTS.override.md`, `AGENTS.md`, and configured fallback names. The open AGENTS.md format describes the file as a predictable "README for agents" with repository-specific commands, testing instructions, and work conventions.

For this single Vite/React repository, a root `AGENTS.md` is the highest-leverage artifact because it is version-controlled, tool-discoverable, and close to the code. Additional subdirectory `AGENTS.md` files should be added only if future directories need genuinely different rules.

### Keep the instruction file short and executable

The AGENTS.md examples emphasize concise development tips, tests, and PR expectations. The arXiv configuration study found repository context files are the dominant configuration mechanism across coding agents, while more advanced mechanisms such as Skills and Subagents are less broadly adopted. This suggests the durable baseline should be a clear root instruction file rather than a complex custom agent system.

The instruction file should avoid restating long philosophy. It should encode observable behavior: research, plan, review, implement, verify, and commit.

### Subagents are useful for review and exploration, with constraints

OpenAI's Subagents guide recommends parallel agents for read-heavy tasks such as exploration, testing, triage, and summarization, and warns that parallel write-heavy workflows can create coordination overhead. It also notes Codex should only spawn subagents when explicitly asked for subagents or parallel agent work.

The user's standing repository policy explicitly requests SubAgent review loops. The resulting rule should therefore prefer SubAgents for substantial planning and adversarial review, while still acknowledging that current runtime/tool policy may forbid or limit spawning. The main agent remains responsible for integrating findings and preserving coherent changes.

### UI/UX review must use rendered evidence

This product is a feature-rich operational workbench. Existing docs already require visual verification with desktop and mobile screenshots for UI work. That should be elevated into the global agent instructions: screenshots or browser inspection are required for UI/UX judgments, because code inspection alone cannot prove hierarchy, overflow, density, or touch ergonomics.

### Research output should be durable

The requested process starts with research and Markdown documentation. For this repository, `docs/research/` is already used for source-backed research, while broader implementation plans live under `docs/`. New work should keep that pattern:

- `docs/research/<topic>.md` for external or technical investigation.
- `docs/<feature-or-architecture>-plan.md` for implementation plans and review logs.

## Adopted Policy Shape

The repository should use:

- Root `AGENTS.md` for always-on instructions.
- `docs/research/agent-development-workflow.md` for the rationale and source trail behind the policy.
- Task-specific docs for substantial future changes, including research notes, plans, review findings, and verification evidence.

## Required Loop For Future Full-Loop Work

The full loop applies to any user-visible behavior change, UI change, dependency or tooling change, data model or persistence change, import/export change, AI/provider/prompt change, security/privacy-sensitive change, performance-sensitive change, build/test configuration change, or multi-file refactor. Typo-only, comment-only, and clearly mechanical formatting edits may use a lighter path.

1. Research current local and external context.
2. Record findings in Markdown.
3. Plan with success criteria and verification.
4. Ask SubAgents to review the plan when available and permitted.
5. Implement.
6. Ask SubAgents for adversarial multi-angle review when available and permitted.
7. Replan and repeat until material findings converge.
8. Verify with tests and, for UI, real rendered screenshots.
9. Commit coherent milestones without including unrelated user changes.

When SubAgents are unavailable, the main agent must run documented independent review passes by role, record why SubAgents were unavailable, and apply the same severity and disposition rules to the findings.

Each substantial task should maintain a task doc under `docs/` or a clear equivalent record containing:

- Research links and relevant takeaways.
- Plan and success criteria.
- Plan-review findings and dispositions.
- Adversarial review findings and dispositions.
- Replan iterations.
- Verification commands, results, and screenshot paths for UI changes.

## Open Constraints

- Runtime-level instructions may still override repository preferences. For example, a platform may require explicit per-turn authorization before spawning SubAgents. The repository rule therefore uses "when available and permitted" rather than claiming unconditional tool access.
- The working tree may contain user edits. Agents must stage only their own milestone changes when committing.
