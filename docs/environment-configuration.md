# Environment Configuration

## Credential Naming

| Previous variable | New variable | Purpose |
| --- | --- | --- |
| `JIRA_EMAIL` | `JIRA_AUTH_EMAIL` | Jira Cloud authentication account. |
| `JIRA_API_TOKEN` | `JIRA_READ_API_TOKEN` | Read-only Jira ticket, comment, field, and PR-context collection. |
| `GITHUB_TOKEN` | `GITHUB_READ_API_TOKEN` | Read-only GitHub PR, metadata, changed-file, and patch access. |

There is no compatibility fallback to the old names. This prevents a publishing credential from being used for a read operation or vice versa.

## Reserved Jira Publishing Configuration

```dotenv
JIRA_PUBLISH_API_TOKEN=
QA_JIRA_PUBLISH_ENABLED=false
QA_JIRA_REQUIRE_APPROVAL=true
```

These variables are parsed but not used by any adapter. Jira report publishing is not implemented. The publishing token is optional, does not replace `JIRA_READ_API_TOKEN`, and does not enable publishing by itself.

## Local .env Migration

The local `.env` file is intentionally ignored by Git and is not changed automatically. Rename its keys manually:

```dotenv
JIRA_EMAIL=...              # replace with JIRA_AUTH_EMAIL=...
JIRA_API_TOKEN=...          # replace with JIRA_READ_API_TOKEN=...
GITHUB_TOKEN=...            # replace with GITHUB_READ_API_TOKEN=...
```

Then add the optional defaults:

```dotenv
QA_JIRA_PUBLISH_ENABLED=false
QA_JIRA_REQUIRE_APPROVAL=true
QA_REPORT_LANGUAGE=es
```

## GitHub Actions Secrets

Rename these repository or environment secrets manually before running the manual QA workflow:

```text
JIRA_EMAIL            -> JIRA_AUTH_EMAIL
JIRA_API_TOKEN        -> JIRA_READ_API_TOKEN
GITHUB_TOKEN          -> GITHUB_READ_API_TOKEN
```

`JIRA_BASE_URL` and `JIRA_CLOUD_ID` keep their existing names. Do not add `JIRA_PUBLISH_API_TOKEN` to the workflow until a separately authorized publishing feature exists.

## Verification

```bash
npm run typecheck
npm run test:unit
npm run qa:ticket -- AGSVK-123
npm run qa:audit -- AGSVK-123 --lang=es
```

The last two commands require valid read credentials. They do not publish to Jira or GitHub.
