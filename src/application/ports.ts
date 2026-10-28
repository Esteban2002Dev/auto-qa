import type { Issue, IssueComment, PullRequest, PullRequestReference, QaReport, TestExecutionResult } from '../domain/entities.js'; import type { StructuredAudit } from '../domain/audit-contract.js'; import type { ReportLanguage } from './report-language.js';

export interface IssueTrackerPort { getIssue(issueKey: string): Promise<Issue>; getComments(issueKey: string): Promise<IssueComment[]>; getParentIssue(issue: Issue): Promise<Issue | null>; getDevelopmentPullRequestReferences?(issue: Issue): Promise<PullRequestReference[]>; }
export interface SourceControlPort { getPullRequest(url: string): Promise<PullRequest>; }
export interface AiAgentPort { audit(input: { ticket: string; context: string; pullRequests: PullRequest[]; language: ReportLanguage }): Promise<StructuredAudit>; }
export interface TestExecutorPort { execute(options: { project?: string; grep?: string }): Promise<TestExecutionResult[]>; }
export interface ReportStoragePort { save(report: QaReport, markdown: string): Promise<{ jsonPath: string; markdownPath: string }>; }
