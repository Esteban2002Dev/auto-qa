# Structured Audit Contract

## Purpose

Claude Code returns a JSON document validated by `AuditContractSchema` in `src/domain/audit-contract.ts`. Free-form Markdown is not accepted as an audit result. A process exit code of zero is insufficient: malformed, empty, truncated, or schema-invalid responses fail validation and block the AI planning stage.

The schema version is currently `1.0.0`.

## Execution Status and QA Verdict

Execution and quality recommendation are independent.

| Field | Values | Meaning |
| --- | --- | --- |
| `executionStatus` | `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `BLOCKED` | Whether Auto-QA completed its own operations. |
| `qaVerdict` | `READY`, `NOT_READY`, `NEEDS_REVIEW`, `INSUFFICIENT_EVIDENCE` | Deterministic system recommendation based on validated data. |
| `aiRecommendedVerdict` | Same verdict values | Claude's recommendation, retained as input rather than final authority. |

`READY` is never an automatic approval. The report also contains `humanReviewRequired`.

## Contract Contents

The audit includes requirements, acceptance criteria, technical risks, findings, test scenarios, regressions, visual items, dependencies, limitations, and sources.

- Requirements use stable IDs and source references.
- Acceptance criteria use `MET`, `NOT_MET`, `PARTIALLY_MET`, `NOT_TESTED`, `BLOCKED`, or `UNKNOWN`.
- Findings include severity, category, verification status, evidence, related requirements, and optional code location.
- Verification status is `OBSERVED`, `REPORTED`, or `SUSPECTED`. Jira comments are always `REPORTED`, never `OBSERVED`, unless the current execution supplied independent evidence.
- Test scenarios are proposals, not test results. Their execution status remains independent from `testResults`.

Evidence origins include Jira descriptions/comments/epics, GitHub PRs/diffs, test results, screenshots, traces, network logs, and other traceable sources.

## Deterministic Verdict Rules

`QaVerdictEvaluator` applies these ordered rules:

1. Verified or reported `CRITICAL`/`HIGH` findings return `NOT_READY`.
2. `NOT_MET` acceptance criteria return `NOT_READY`.
3. Blocked criteria or declared dependencies return `NEEDS_REVIEW`.
4. Partially met, untested, unknown, or evidence-free criteria return `INSUFFICIENT_EVIDENCE`.
5. Functional scenarios without passing functional execution evidence return `INSUFFICIENT_EVIDENCE`.
6. A remaining explicit human-review requirement returns `NEEDS_REVIEW`.
7. Only sufficient evidence without blockers can return `READY`.

Suspected risks do not become confirmed defects automatically. The rules are injected through `QaVerdictEvaluator` and can be configured or extended without modifying adapters.

## Sanitized Example

```json
{
  "schemaVersion": "1.0.0",
  "ticketKey": "AGSVK-5234",
  "executionStatus": "COMPLETED",
  "qaVerdict": "INSUFFICIENT_EVIDENCE",
  "aiRecommendedVerdict": "INSUFFICIENT_EVIDENCE",
  "humanReviewRequired": true,
  "acceptanceCriteria": [
    {
      "id": "AC-1",
      "status": "NOT_TESTED",
      "evidence": []
    }
  ],
  "findings": [],
  "limitations": ["No functional tests were executed."]
}
```

## Safety

Input context and validated output are sanitized before prompts, reports, and error messages. The adapter does not log full Claude output. It invokes Claude without a shell, uses a timeout, retries only contract-validation errors once, and fails closed into a `BLOCKED` execution with a non-approval verdict when no valid audit exists.
