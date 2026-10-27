import type { Issue, IssueComment, PullRequest, QaReport, TestExecutionResult } from '../domain/entities.js';

export interface IssueTrackerPort { getIssue(issueKey: string): Promise<Issue>; getComments(issueKey: string): Promise<IssueComment[]>; getParentIssue(issue: Issue): Promise<Issue | null>; }
export interface SourceControlPort { getPullRequest(url: string): Promise<PullRequest>; }
export interface AiAgentPort { audit(input: { ticket: string; context: string; pullRequests: PullRequest[] }): Promise<{ report: string; stderr: string }>; }
export interface TestExecutorPort { execute(options: { project?: string; grep?: string }): Promise<TestExecutionResult[]>; }
export interface ReportStoragePort { save(report: QaReport, markdown: string): Promise<{ jsonPath: string; markdownPath: string }>; }
