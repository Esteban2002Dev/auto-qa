# Auto-QA: Context and Architecture

## Purpose

Auto-QA is an internal framework that supports quality reviews for development tickets. It gathers Jira context, identifies related pull requests, reads GitHub changes when access is available, requests a static review from Claude Code, and stores QA outcomes as structured data.

It does not replace human approval and does not publish results to Jira or GitHub. Its purpose is to provide evidence and a repeatable foundation for QA and engineering teams to make informed decisions.

## Functional Flow

1. A ticket key is received, for example `AGSVK-123`.
2. Jira provides the summary, description, comments, and parent issue when available.
3. Complete GitHub pull request URLs are extracted from the retrieved content.
4. GitHub reads accessible pull requests and their changed files.
5. Claude Code produces a static audit and test plan without modifying repositories.
6. Playwright can optionally run suites configured for the target environment.
7. Markdown and JSON reports are written to `reports/`.

Results distinguish between passed, failed, skipped, and blocked work. Missing integration access is never reported as a successful result.

## Architecture

The codebase uses ports and adapters:

- `src/domain`: provider-independent QA entities and states.
- `src/application`: ports, use cases, and orchestration. This layer does not import Jira, GitHub, Claude, or Playwright.
- `src/infrastructure`: concrete API, local-process, configuration, and report-storage adapters.
- `src/presentation/cli`: command-line entry points.
- `src/bootstrap/container.ts`: explicit dependency composition.

To add another ticket, source-control, AI, or test-execution provider, implement the relevant port and replace the dependency in the container without changing orchestration logic.

## Security and Current Limitations

- Jira and GitHub integrations are read-only; they never create comments, approvals, merges, or remote changes.
- Pull request URLs are validated so arbitrary text is not treated as a confirmed PR.
- Claude and Playwright run without `shell`, with timeouts, and without injecting Jira content into system commands.
- Ticket and pull request content is treated as untrusted data when sent to the local agent.
- Interactive Claude Team authentication is not available for hosted GitHub Actions runners.
- Epic detection currently uses `fields.parent`; custom Jira fields require explicit mapping.
- Automatic Jira publishing and automatic ticket-to-test selection are not implemented yet.
