export type QaExecutionStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'SKIPPED' | 'BLOCKED';
export type FindingKind = 'PRODUCT_FAILURE' | 'INFRASTRUCTURE_FAILURE' | 'MISSING_INFORMATION' | 'POTENTIAL_FINDING' | 'CONFIRMED_DEFECT';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Issue { key: string; summary: string; description: string; status: string | null; type: string | null; priority: string | null; parentKey: string | null; metadata: Record<string, string>; url?: string; }
export interface IssueComment { id: string; author: string | null; created: string | null; text: string; }
export interface ChangedFile { path: string; status: string; additions: number; deletions: number; patch: string | null; }
export interface PullRequest { id: string; provider: string; repository: string; title: string; description: string | null; sourceBranch: string; targetBranch: string; commitSha: string; changedFiles: ChangedFile[]; url: string; }
export interface TicketContext { issue: Issue; parent: Issue | null; comments: IssueComment[]; pullRequestUrls: string[]; }
export interface TestExecutionResult { name: string; status: QaExecutionStatus; durationMs: number | null; error: string | null; evidence: string[]; }
export interface QaFinding { title: string; description: string; severity: Severity; kind: FindingKind; evidence: string[]; }
export interface QaEvidence { type: 'SCREENSHOT' | 'TRACE' | 'LOG' | 'REPORT'; path: string; }
export interface QaReport { ticketKey: string; summary: string; executionId: string; status: QaExecutionStatus; findings: QaFinding[]; testResults: TestExecutionResult[]; evidence: QaEvidence[]; generatedAt: string; stages: Record<string, QaExecutionStatus>; }
