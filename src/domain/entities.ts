export type QaExecutionStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'SKIPPED' | 'BLOCKED';
export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'BLOCKED';
export type QaVerdict = 'READY' | 'NOT_READY' | 'NEEDS_REVIEW' | 'INSUFFICIENT_EVIDENCE';
export type FindingKind = 'PRODUCT_FAILURE' | 'INFRASTRUCTURE_FAILURE' | 'MISSING_INFORMATION' | 'POTENTIAL_FINDING' | 'CONFIRMED_DEFECT';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'INFO';

export interface Issue { key: string; summary: string; description: string; status: string | null; type: string | null; priority: string | null; parentKey: string | null; metadata: Record<string, string>; url?: string; }
export interface IssueComment { id: string; author: string | null; created: string | null; text: string; }
export interface ChangedFile { path: string; status: string; additions: number; deletions: number; patch: string | null; }
export interface PullRequest { id: string; provider: string; repository: string; title: string; description: string | null; sourceBranch: string; targetBranch: string; commitSha: string; changedFiles: ChangedFile[]; url: string; }
export type PullRequestReferenceSource = 'JIRA_FIELD' | 'JIRA_DESCRIPTION' | 'JIRA_COMMENT' | 'JIRA_DEVELOPMENT';
export interface PullRequestReference { raw: string; source: PullRequestReferenceSource; sourceReference: string; owner: string | null; repository: string | null; number: number | null; url: string | null; }
export interface TicketContext { issue: Issue; parent: Issue | null; comments: IssueComment[]; pullRequestUrls: string[]; pullRequestReferences: PullRequestReference[]; }
export interface TestExecutionResult { name: string; status: QaExecutionStatus; durationMs: number | null; error: string | null; evidence: string[]; }
export interface QaFinding { title: string; description: string; severity: Severity; kind: FindingKind; evidence: string[]; }
export interface QaEvidence { type: 'SCREENSHOT' | 'TRACE' | 'LOG' | 'REPORT'; path: string; }
export interface QaReport { schemaVersion: string; ticketKey: string; summary: string; executionId: string; executionStatus: ExecutionStatus; qaVerdict: QaVerdict; aiRecommendedVerdict: QaVerdict; humanReviewRequired: boolean; requirements: import('./audit-contract.js').StructuredAudit['requirements']; acceptanceCriteria: import('./audit-contract.js').StructuredAudit['acceptanceCriteria']; findings: import('./audit-contract.js').StructuredAudit['findings']; testScenarios: import('./audit-contract.js').StructuredAudit['testScenarios']; limitations: string[]; sources: import('./audit-contract.js').StructuredAudit['sources']; testResults: TestExecutionResult[]; evidence: QaEvidence[]; generatedAt: string; stages: Record<string, QaExecutionStatus>; stageResults: Record<string, QaExecutionStatus>; }
