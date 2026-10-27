# Auto-QA

See the [project context and architecture](docs/project-context.md) and the [commands guide](docs/use-comand.md).

Auto-QA is an internal framework for gathering ticket context, reviewing pull requests in read-only mode, requesting local Claude Code audits, and storing structured QA results.

## Architecture

`domain` contains pure models. `application` contains ports and orchestration; it does not know Jira, GitHub, Claude, or Playwright. `infrastructure` implements those ports. `presentation/cli` provides entry points and `bootstrap/container.ts` composes dependencies explicitly. This separation allows new providers to be added by implementing the relevant port without changing the orchestrator.

## Local Setup

Copy `.env.example` to `.env` and configure Jira credentials. `GITHUB_TOKEN` is optional for public PRs and required for private ones. Credentials are never printed. Claude Code uses its local session and is not enabled on hosted runners.

## Commands

```bash
npm run typecheck
npm run test:unit
npm run test:e2e
npm run qa:ticket -- AGSVK-123
npm run qa:audit -- AGSVK-123
npm run qa:run -- AGSVK-123
```

`qa:ticket` normalizes Jira data, comments, and PR URLs. `qa:audit` collects context and invokes Claude, saving JSON and Markdown reports in `reports/`. `qa:run` adds Playwright. The example suite must not be interpreted as approval evidence for Vivook tickets; select or create relevant tests before using that command as a QA signal.

## Extensibility and Security

To add an alternative Jira provider, source-control service, AI provider, or executor, implement `IssueTrackerPort`, `SourceControlPort`, `AiAgentPort`, or `TestExecutorPort` and compose it in the container. Adapters are read-only: there are no merges, comments, or external publishing. PR URLs are validated, processes do not use a shell and have timeouts, and remote context is marked as untrusted for Claude.

## Limitations

Epic detection uses `fields.parent`; custom fields must be mapped after confirming their identifier in the Jira instance. Claude Team authentication remains local until an authorized CI mechanism is available. Jira report publishing and automatic ticket-to-test selection are not implemented yet.
