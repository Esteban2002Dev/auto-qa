# Auto-QA: Commands

## Local Requirements

1. Node.js and project dependencies installed with `npm ci`.
2. Playwright browsers installed when running E2E tests: `npx playwright install`.
3. A `.env` file created from `.env.example`.
4. Claude Code authenticated locally, only for `qa:audit` and `qa:run`.

Available configuration:

| Variable | Purpose | Required |
| --- | --- | --- |
| `JIRA_BASE_URL` | Public URL of the Jira instance | Yes |
| `JIRA_CLOUD_ID` | Jira Cloud identifier used by the Atlassian API | Yes |
| `JIRA_EMAIL` | Authorized Jira technical account | Yes |
| `JIRA_API_TOKEN` | Scoped Jira API token | Yes |
| `GITHUB_TOKEN` | Private PR access and higher GitHub API limits | No |

Never include credentials in commands, reports, source code, or versioned files.

## Type Checking

```bash
npm run typecheck
```

Runs TypeScript in strict mode without emitting compiled files.

## Unit Tests

```bash
npm run test:unit
```

Runs isolated tests without real credentials, including ADF conversion, PR extraction, and orchestrator status handling.

## E2E Tests

```bash
npm run test:e2e
```

Runs Playwright files matching `*.spec.ts`. Results are valid ticket evidence only when the selected tests target an authorized environment and cover the reviewed change. External example tests are not an approval signal for Vivook tickets.

## Retrieve a Ticket

```bash
npm run qa:ticket -- AGSVK-123
```

Reads Jira and prints the normalized ticket, comments, parent relationship, and detected PR URLs. It does not call Claude or run Playwright.

## Audit a Ticket

```bash
npm run qa:audit -- AGSVK-123
```

Collects ticket context, attempts to read accessible pull requests, and invokes the local Claude Code agent for a static audit. It creates two files in `reports/`:

- `<ticket>-<executionId>.json`: structured outcomes, statuses, findings, and evidence.
- `<ticket>-<executionId>.md`: a human-readable review report.

If GitHub or Claude is unavailable, the report records the limitation as a finding or `BLOCKED` status; it does not simulate a complete audit.

## Run the Flow with Playwright

```bash
npm run qa:run -- AGSVK-123
```

Performs the same work as `qa:audit` and also runs Playwright. Use it only when the suite contains relevant tests and the target environment is configured. It never generates or executes arbitrary AI-produced code.

## Execution Statuses

| Status | Meaning |
| --- | --- |
| `PENDING` | The stage has not started. |
| `RUNNING` | The stage is in progress. |
| `PASSED` | The stage completed successfully. |
| `FAILED` | The stage failed; the finding identifies product or infrastructure context. |
| `SKIPPED` | The stage was not applicable or was not requested. |
| `BLOCKED` | Required data, access, or a dependency is unavailable. |
