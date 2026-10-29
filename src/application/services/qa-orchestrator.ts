import { randomUUID } from 'node:crypto';
import type { AiAgentPort, IssueTrackerPort, ReportStoragePort, SourceControlPort, TestExecutorPort } from '../ports.js';
import type { PullRequest, QaReport, QaExecutionStatus, TestExecutionResult, TicketContext, ExecutionStatus, ReviewedPullRequest } from '../../domain/entities.js';
import { AUDIT_SCHEMA_VERSION, type StructuredAudit } from '../../domain/audit-contract.js';
import { collectTicketContext } from '../use-cases.js';
import { QaVerdictEvaluator } from './qa-verdict-evaluator.js';
import { sanitizeData, sanitizeText } from '../sanitize.js';
import type { ReportLanguage } from '../report-language.js';
import { renderReportMarkdown } from '../report-markdown.js';
import type { RepositoryAliases } from '../pull-request-url.js';

const initialStages = (): Record<string, QaExecutionStatus> => ({ COLLECT_CONTEXT: 'PENDING', REVIEW_CODE: 'PENDING', PLAN_TESTS: 'PENDING', EXECUTE_TESTS: 'PENDING', GENERATE_REPORT: 'PENDING' });
const fallbackAudit = (ticketKey: string, limitation: string): StructuredAudit => ({ schemaVersion: AUDIT_SCHEMA_VERSION, ticketKey, analysisSummary: 'No valid AI audit was available.', requirements: [], acceptanceCriteria: [], technicalRisks: [], findings: [], testScenarios: [], potentialRegressions: [], visualValidationItems: [], dependenciesAndBlockers: [limitation], sources: [], limitations: [limitation], aiRecommendedVerdict: 'INSUFFICIENT_EVIDENCE', humanReviewRequired: true });

export class QaOrchestrator {
  constructor(private readonly tracker: IssueTrackerPort, private readonly sourceControl: SourceControlPort, private readonly ai: AiAgentPort, private readonly tests: TestExecutorPort, private readonly storage: ReportStoragePort, private readonly verdictEvaluator = new QaVerdictEvaluator(), private readonly reportLanguage: ReportLanguage = 'es', private readonly repositoryAliases: RepositoryAliases = {}) {}
  async collect(issueKey: string): Promise<TicketContext> { return collectTicketContext(issueKey, this.tracker, this.repositoryAliases); }
  async audit(issueKey: string, executeTests = false): Promise<{ report: QaReport; markdown: string }> {
    const stages = initialStages(); let context: TicketContext;
    try { context = await this.collect(issueKey); stages.COLLECT_CONTEXT = 'PASSED'; } catch (error) { stages.COLLECT_CONTEXT = 'FAILED'; throw error; }
    const prs: PullRequest[] = []; const integrationLimitations: string[] = context.pullRequestReferences.filter(reference => !reference.url).map(reference => `Unresolved pull request reference (${reference.source}): ${reference.raw}`);
    for (const url of context.pullRequestUrls) try { prs.push(await this.sourceControl.getPullRequest(url)); } catch (error) { integrationLimitations.push(`Pull request unavailable: ${errorMessage(error)}`); }
    let audit: StructuredAudit;
    try { audit = await this.ai.audit({ ticket: context.issue.key, context: sanitizeText(JSON.stringify({ issue: context.issue, parent: context.parent, comments: context.comments })), pullRequests: sanitizeData(prs), language: this.reportLanguage }); audit = prepareTestPlan(audit); stages.PLAN_TESTS = 'PASSED'; } catch (error) { const limitation = `Structured AI audit unavailable: ${errorMessage(error)}`; audit = fallbackAudit(context.issue.key, limitation); integrationLimitations.push(limitation); stages.PLAN_TESTS = 'BLOCKED'; }
    const codeWasAnalysed = prs.length > 0 && audit.sources.some(source => source.origin === 'GITHUB_PR' || source.origin === 'GITHUB_DIFF');
    stages.REVIEW_CODE = context.pullRequestReferences.length === 0 ? 'SKIPPED' : codeWasAnalysed ? 'PASSED' : 'BLOCKED';
    if (context.pullRequestReferences.length > 0 && !codeWasAnalysed) integrationLimitations.push('Pull request code was not confirmed as analysed by the validated audit.');
    let testResults: TestExecutionResult[] = [];
    if (executeTests) { try { testResults = await this.tests.execute({ scenarios: audit.testScenarios }); audit = applyTestResults(audit, testResults); stages.EXECUTE_TESTS = testResults.some(result => result.status === 'FAILED') ? 'FAILED' : 'PASSED'; } catch (error) { integrationLimitations.push(`Test execution failed: ${errorMessage(error)}`); stages.EXECUTE_TESTS = 'FAILED'; } } else stages.EXECUTE_TESTS = 'SKIPPED';
    stages.GENERATE_REPORT = 'PASSED'; const executionStatus: ExecutionStatus = Object.values(stages).includes('FAILED') ? 'FAILED' : Object.values(stages).includes('BLOCKED') ? 'BLOCKED' : 'COMPLETED';
    const qaVerdict = this.verdictEvaluator.evaluate(audit, testResults); const limitations = [...audit.limitations, ...integrationLimitations]; const pullRequests = reviewedPullRequests(context, prs, audit);
    const report = sanitizeData<QaReport>({ schemaVersion: audit.schemaVersion, ticketKey: context.issue.key, summary: context.issue.summary, executionId: randomUUID(), executionStatus, qaVerdict, aiRecommendedVerdict: audit.aiRecommendedVerdict, humanReviewRequired: audit.humanReviewRequired || qaVerdict !== 'READY', reportLanguage: this.reportLanguage, pullRequests, requirements: audit.requirements, acceptanceCriteria: audit.acceptanceCriteria, findings: audit.findings, testScenarios: audit.testScenarios, limitations, sources: audit.sources, testResults, evidence: [], generatedAt: new Date().toISOString(), stages, stageResults: stages });
    return { report, markdown: renderReportMarkdown(report) };
  }
  async save(report: QaReport, markdown: string) { return this.storage.save(report, markdown); }
}

export function prepareTestPlan(audit: StructuredAudit): StructuredAudit { const missingRequirements = audit.requirements.length === 0 && !audit.limitations.some(limitation => limitation.startsWith('Información pendiente:')); return { ...audit, testScenarios: audit.testScenarios.map(scenario => ({ ...scenario, executionStatus: 'NOT_EXECUTED' })), limitations: missingRequirements ? [...audit.limitations, 'Información pendiente: el ticket no contiene requisitos verificables.'] : audit.limitations }; }
type TestScenarioExecutionStatus = StructuredAudit['testScenarios'][number]['executionStatus'];
const scenarioStatus = (status: TestExecutionResult['status']): TestScenarioExecutionStatus => status === 'PASSED' || status === 'FAILED' || status === 'BLOCKED' || status === 'SKIPPED' ? status : 'NOT_EXECUTED';
export function applyTestResults(audit: StructuredAudit, testResults: TestExecutionResult[]): StructuredAudit { const statusByScenarioId = new Map<string, TestScenarioExecutionStatus>(testResults.filter(result => result.scenarioId).map(result => [result.scenarioId!, scenarioStatus(result.status)])); return { ...audit, testScenarios: audit.testScenarios.map(scenario => ({ ...scenario, executionStatus: statusByScenarioId.get(scenario.id) ?? scenario.executionStatus })) }; }
function reviewedPullRequests(context: TicketContext, prs: PullRequest[], audit: StructuredAudit): ReviewedPullRequest[] { const retrieved = new Map(prs.map(pr => [pr.url, pr])); return context.pullRequestReferences.filter(reference => reference.url && reference.owner && reference.repository && reference.number).map(reference => { const pr = retrieved.get(reference.url!); const repository = `${reference.owner}/${reference.repository}`; const githubSources = audit.sources.filter(source => source.origin === 'GITHUB_PR' || source.origin === 'GITHUB_DIFF'); const reviewed = Boolean(pr && githubSources.some(source => source.reference.includes(reference.url!) || source.reference.includes(pr.commitSha) || source.reference.includes(repository))); return { url: reference.url!, repository, number: reference.number!, commitSha: pr?.commitSha ?? null, reviewStatus: !pr ? 'BLOCKED' : reviewed ? 'REVIEWED' : githubSources.length > 0 ? 'PARTIAL' : 'BLOCKED' }; }); }
const errorMessage = (error: unknown) => sanitizeText(error instanceof Error ? error.message : 'Unknown error');
export const renderMarkdown = renderReportMarkdown;
