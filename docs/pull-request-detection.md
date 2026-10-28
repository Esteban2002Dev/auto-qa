# Pull Request Detection from Jira

## Sources

Auto-QA consolidates pull request references from four independent sources before calling GitHub:

1. Configured or automatically discovered Jira PR fields.
2. Jira issue description.
3. All paginated Jira comments.
4. Jira development integration, when the authorized development-status endpoint is available.

Every reference keeps its source (`JIRA_FIELD`, `JIRA_DESCRIPTION`, `JIRA_COMMENT`, or `JIRA_DEVELOPMENT`) and a stable source reference. Duplicate resolved references are consolidated by `owner/repository#number`.

## Confirmed Jira Field

The Jira metadata query performed for this instance identified the visible **PR** field as:

```text
Field ID: customfield_10113
Name: PR
Type: custom string
```

The field was empty for `AGSVK-5234`, so detection continued through the remaining sources. The ticket has two comments and one contains the abbreviated reference `vivook-angular#1256`.

To avoid relying on name discovery, configure this field explicitly:

```dotenv
JIRA_PULL_REQUEST_FIELD_IDS=customfield_10113
```

## Supported Formats

```text
https://github.com/owner/repository/pull/123
owner/repository#123
repository-alias#123
```

## How to Attach a Pull Request for Detection

Auto-QA reads references from the Jira **PR custom field**, the issue **description**, all issue **comments**, and Jira's native development integration when it is available.

Use one of the following formats in any of those locations:

### Full GitHub Pull Request URL

```text
https://github.com/AGS-Vivook/vivook-angular/pull/1256
```

This is the preferred format because the owner, repository, and pull request number are explicit.

### Full Repository Reference

```text
AGS-Vivook/vivook-angular#1256
```

Use this when a shorter reference is preferred but the GitHub owner is known.

### Configured Repository Alias

```text
vivook-angular#1256
```

This works for the known AGS-Vivook repository aliases listed in the local configuration. It is the expected format for references such as `vivook-angular#1256` in Jira comments.

### Jira PR Field

The confirmed PR field in this Jira instance is `customfield_10113`. Enter any supported format into the visible **PR** field, for example:

```text
vivook-nest-api#42
```

### Recommended Ticket Comment

Use a clear, standalone comment when linking a pull request:

```text
Implementation PR: vivook-angular#1256
```

Multiple PRs can be included in a single description or comment, separated by spaces or new lines:

```text
Frontend: vivook-angular#1256
API: vivook-nest-api#42
```

Do not use only a pull request number such as `#1256`, an incomplete URL, or an unknown alias. Those references cannot be resolved safely and will be recorded as incomplete coverage instead of being sent to GitHub.

An alias is resolved only through explicit configuration. Configure aliases as comma-separated values:

```dotenv
GITHUB_REPOSITORY_ALIASES=vivook-angular=AGS-Vivook/vivook-angular,angular-vivook=AGS-Vivook/vivook-angular
```

The listed AGS-Vivook repositories are included as safe defaults. Environment values can override a default alias. Unknown aliases remain unresolved and are recorded as incomplete code-review coverage; Auto-QA never guesses an owner.

| Alias | Default GitHub repository |
| --- | --- |
| `vivook-nest-api` | `AGS-Vivook/vivook-nest-api` |
| `vivook-angular` / `angular-vivook` | `AGS-Vivook/vivook-angular` |
| `vivook2020-node` | `AGS-Vivook/vivook2020-node` |
| `crm-nest` | `AGS-Vivook/crm-nest` |
| `crm-angular` | `AGS-Vivook/crm-angular` |
| `vivook-whatsapp` | `AGS-Vivook/vivook-whatsapp` |
| `vivook-qa` | `AGS-Vivook/Vivook-QA` |
| `vivook-web` | `AGS-Vivook/vivook-web` |
| `vivook-agents` | `AGS-Vivook/vivook-agents` |

## Development Integration

The Jira adapter attempts the read-only development-status endpoint for GitHub pull requests. If the endpoint is unavailable or not authorized, it returns no development references and continues with fields, description, and comments. This limitation does not stop the audit.

## Code Review Completion

Finding a URL does not complete code review. `REVIEW_CODE` becomes `PASSED` only when:

1. At least one resolved PR was successfully retrieved from GitHub; and
2. The validated Claude audit cites a `GITHUB_PR` or `GITHUB_DIFF` source.

Otherwise the stage is `BLOCKED` when references exist, or `SKIPPED` when none exist.
