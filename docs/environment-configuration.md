# Environment Configuration

## Credential Naming

| Previous variable | New variable | Purpose |
| --- | --- | --- |
| `JIRA_EMAIL` | `JIRA_AUTH_EMAIL` | Jira Cloud authentication account. |
| `JIRA_API_TOKEN` | `JIRA_READ_API_TOKEN` | Read-only Jira ticket, comment, field, and PR-context collection. |
| `GITHUB_TOKEN` | `GITHUB_READ_API_TOKEN` | Read-only GitHub PR, metadata, changed-file, and patch access. |

There is no compatibility fallback to the old names. This prevents a publishing credential from being used for a read operation or vice versa.

## Jira Comment Publishing Configuration

```dotenv
JIRA_PUBLISH_API_TOKEN=
QA_JIRA_PUBLISH_ENABLED=false
QA_JIRA_REQUIRE_APPROVAL=true
```

`JIRA_PUBLISH_API_TOKEN` is used only by the Jira comment-publishing adapter; it never replaces `JIRA_READ_API_TOKEN`. A scoped Atlassian API token uses HTTP Basic authentication with `JIRA_AUTH_EMAIL` and must be created by that same account. Its Jira calls use `https://api.atlassian.com/ex/jira/${JIRA_CLOUD_ID}`.

For the complete Auto-QA comment workflow, configure only these granular Jira scopes (the token UI may omit the `:jira` suffix in its labels):

```text
read:permission:jira
read:comment:jira
read:comment.property:jira
read:group:jira
read:project:jira
read:project-role:jira
read:user:jira
read:avatar:jira
write:comment:jira
```

`read:permission:jira` covers the preflight `GET /rest/api/3/mypermissions`. The seven comment-read scopes are required by Jira for listing or obtaining comments, which Auto-QA uses to reconcile an uncertain POST and prevent duplicates. `write:comment:jira` covers creation and update. Auto-QA does not send comment properties, delete comments, or modify issues, so it does not require write/delete property scopes, delete-comment, or issue-write scopes. The publishing account must also have Jira project permissions: Browse Projects and Add Comments to create; Browse Projects and Edit Own Comments to update its own comment.

Run this safe diagnostic after changing scopes; it executes only `GET /rest/api/3/mypermissions` and `GET /rest/api/3/issue/{ticketKey}/comment`, and creates or edits no ticket:

```bash
npm run qa:jira-publish-auth -- AGSVK-5447
```

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

`JIRA_BASE_URL` and `JIRA_CLOUD_ID` keep their existing names. Do not enable `JIRA_PUBLISH_API_TOKEN` in an automated workflow until publication has been separately authorized.

## Verification

```bash
npm run typecheck
npm run test:unit
npm run qa:ticket -- AGSVK-123
npm run qa:audit -- AGSVK-123 --lang=es
```

The last two commands require valid read credentials. They do not publish to Jira or GitHub.
