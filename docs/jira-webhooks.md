# Jira Webhooks

## Safe Default

The receiver listens only on `127.0.0.1:3100` by default and starts in `debug` mode. Debug mode validates, persists, and deduplicates eligible events without invoking Claude Code, Playwright, or Jira publishing.

```bash
npm run qa:webhook
curl http://127.0.0.1:3100/health
```

Set `QA_WEBHOOK_ENABLED=true` and configure at least one authentication secret before starting it.

## Configuration

```dotenv
QA_WEBHOOK_ENABLED=true
QA_WEBHOOK_HOST=127.0.0.1
QA_WEBHOOK_PORT=3100
QA_WEBHOOK_SECRET=replace-with-hmac-secret
QA_WEBHOOK_MODE=debug
QA_TRIGGER_PROJECT_KEY=AGSVK
QA_TRIGGER_STATUS=Por revisar
QA_TRIGGER_ASSIGNEE_ACCOUNT_IDS=qa-account-id-1,qa-account-id-2
QA_COMMAND_ALLOWED_ACCOUNT_IDS=your-qa-account-id
QA_EXECUTION_DB_PATH=./data/auto-qa.sqlite
```

Native Jira Cloud webhooks must include `X-Hub-Signature` in the exact format `sha256=<hmac>`. Auto-QA calculates HMAC-SHA256 over the original request body using `QA_WEBHOOK_SECRET` and compares the complete value with a timing-safe operation. Requests without a signature, with an unsupported format, or with an invalid signature are rejected.

Jira Automation may instead use `Authorization: Bearer <QA_WEBHOOK_AUTOMATION_SECRET>`; it is intentionally separate from the native HMAC secret. Do not configure Automation to reuse the HMAC header or secret.

## Atlassian Studio

For a Studio automation triggered by **Issue transitioned**, configure a `POST` to `/webhooks/jira` with this exact JSON body. Do not include an empty `timestamp` or a synthetic `changelog`; Auto-QA reads Jira's changelog and uses the actual transition ID as the QA-cycle identity.

```json
{
  "source": "atlassian_studio",
  "event": "issue_updated",
  "issueKey": "{{issue.key}}",
  "issueId": "{{issue.id}}"
}
```

Set the request header to `Authorization: Bearer <QA_WEBHOOK_AUTOMATION_SECRET>`. Auto-QA fetches the latest transition into `QA_TRIGGER_STATUS` from Jira, so retries of the same Studio event create only one job and a later re-entry into QA creates a new job.

When Jira sends `X-Atlassian-Webhook-Identifier`, Auto-QA stores it as the delivery identity. Repeated delivery IDs are idempotent even when their request bodies differ. This identifier is never used as the QA cycle ID; QA cycles continue to use the Jira transition or comment identity.

## Jira Setup

1. Start in `debug` mode on localhost.
2. Expose the endpoint through an approved HTTPS tunnel or internal ingress; never bind directly to the public internet without an approved reverse proxy.
3. Configure Jira Cloud to send issue update and comment-created events to `https://your-approved-host/webhooks/jira`.
4. Configure the HMAC signature or the separate Automation bearer secret.
5. Transition an AGSVK ticket assigned to the configured QA account into `Por revisar`.
6. Verify that repeated delivery of the same request produces one stored event and one job.

The SQLite database stores event IDs, QA cycle IDs, jobs, execution IDs, and report/plan paths only. The structured plan remains in its existing JSON report under `reports/`; it is never duplicated in SQLite. Each job reserves a nullable Jira-comment ID for later publishing integration. `RUNNING` jobs are returned to `PENDING` after a receiver restart, while a failed job retains its plan path and can be retried through the history adapter.

## Modes

| Mode | Behavior |
| --- | --- |
| `debug` | Stores an explicit `SIMULATED` job. It never invokes Claude. |
| `audit` | Queues the existing `QaOrchestrator` audit without Playwright or Jira publishing. |

Do not enable `audit` until the webhook is validated in `debug` mode and Claude Code has an authorized local session.
