import { randomUUID } from 'node:crypto';
import type { AiAgentPort, IssueTrackerPort, ReportStoragePort, SourceControlPort, TestExecutorPort } from '../ports.js';
import type { PullRequest, QaReport, QaExecutionStatus, TestExecutionResult, TicketContext, ExecutionStatus } from '../../domain/entities.js';
import { AUDIT_SCHEMA_VERSION, type StructuredAudit } from '../../domain/audit-contract.js';
import { collectTicketContext } from '../use-cases.js';
import { QaVerdictEvaluator } from './qa-verdict-evaluator.js';
import { sanitizeData, sanitizeText } from '../sanitize.js';

const initialStages = (): Record<string, QaExecutionStatus> => ({ COLLECT_CONTEXT: 'PENDING', REVIEW_CODE: 'PENDING', PLAN_TESTS: 'PENDING', EXECUTE_TESTS: 'PENDING', GENERATE_REPORT: 'PENDING' });
const fallbackAudit = (ticketKey: string, limitation: string): StructuredAudit => ({ schemaVersion: AUDIT_SCHEMA_VERSION, ticketKey, analysisSummary: 'No valid AI audit was available.', requirements: [], acceptanceCriteria: [], technicalRisks: [], findings: [], testScenarios: [], potentialRegressions: [], visualValidationItems: [], dependenciesAndBlockers: [limitation], sources: [], limitations: [limitation], aiRecommendedVerdict: 'INSUFFICIENT_EVIDENCE', humanReviewRequired: true });

export class QaOrchestrator {
  constructor(private readonly tracker: IssueTrackerPort, private readonly sourceControl: SourceControlPort, private readonly ai: AiAgentPort, private readonly tests: TestExecutorPort, private readonly storage: ReportStoragePort, private readonly verdictEvaluator = new QaVerdictEvaluator()) {}
  async collect(issueKey: string): Promise<TicketContext> { return collectTicketContext(issueKey, this.tracker); }
  async audit(issueKey: string, executeTests = false): Promise<{ report: QaReport; markdown: string }> {
    const stages = initialStages(); let context: TicketContext;
    try { context = await this.collect(issueKey); stages.COLLECT_CONTEXT = 'PASSED'; } catch (error) { stages.COLLECT_CONTEXT = 'FAILED'; throw error; }
    const prs: PullRequest[] = []; const integrationLimitations: string[] = context.pullRequestReferences.filter(reference => !reference.url).map(reference => `Unresolved pull request reference (${reference.source}): ${reference.raw}`);
    for (const url of context.pullRequestUrls) try { prs.push(await this.sourceControl.getPullRequest(url)); } catch (error) { integrationLimitations.push(`Pull request unavailable: ${errorMessage(error)}`); }
    let audit: StructuredAudit;
    try { audit = await this.ai.audit({ ticket: context.issue.key, context: sanitizeText(JSON.stringify({ issue: context.issue, parent: context.parent, comments: context.comments })), pullRequests: sanitizeData(prs) }); stages.PLAN_TESTS = 'PASSED'; } catch (error) { const limitation = `Structured AI audit unavailable: ${errorMessage(error)}`; audit = fallbackAudit(context.issue.key, limitation); integrationLimitations.push(limitation); stages.PLAN_TESTS = 'BLOCKED'; }
    const codeWasAnalysed = prs.length > 0 && audit.sources.some(source => source.origin === 'GITHUB_PR' || source.origin === 'GITHUB_DIFF');
    stages.REVIEW_CODE = context.pullRequestReferences.length === 0 ? 'SKIPPED' : codeWasAnalysed ? 'PASSED' : 'BLOCKED';
    if (context.pullRequestReferences.length > 0 && !codeWasAnalysed) integrationLimitations.push('Pull request code was not confirmed as analysed by the validated audit.');
    let testResults: TestExecutionResult[] = [];
    if (executeTests) { try { testResults = await this.tests.execute({}); stages.EXECUTE_TESTS = testResults.some(result => result.status === 'FAILED') ? 'FAILED' : 'PASSED'; } catch (error) { integrationLimitations.push(`Test execution failed: ${errorMessage(error)}`); stages.EXECUTE_TESTS = 'FAILED'; } } else stages.EXECUTE_TESTS = 'SKIPPED';
    stages.GENERATE_REPORT = 'PASSED'; const executionStatus: ExecutionStatus = Object.values(stages).includes('FAILED') ? 'FAILED' : Object.values(stages).includes('BLOCKED') ? 'BLOCKED' : 'COMPLETED';
    const qaVerdict = this.verdictEvaluator.evaluate(audit, testResults); const limitations = [...audit.limitations, ...integrationLimitations];
    const report = sanitizeData<QaReport>({ schemaVersion: audit.schemaVersion, ticketKey: context.issue.key, summary: context.issue.summary, executionId: randomUUID(), executionStatus, qaVerdict, aiRecommendedVerdict: audit.aiRecommendedVerdict, humanReviewRequired: audit.humanReviewRequired || qaVerdict !== 'READY', requirements: audit.requirements, acceptanceCriteria: audit.acceptanceCriteria, findings: audit.findings, testScenarios: audit.testScenarios, limitations, sources: audit.sources, testResults, evidence: [], generatedAt: new Date().toISOString(), stages, stageResults: stages });
    return { report, markdown: renderMarkdown(report) };
  }
  async save(report: QaReport, markdown: string) { return this.storage.save(report, markdown); }
}
const errorMessage = (error: unknown) => sanitizeText(error instanceof Error ? error.message : 'Unknown error');
export function renderMarkdown(report: QaReport): string { return `# QA Report: ${report.ticketKey}\n\n**Execution status:** ${report.executionStatus}\n\n**QA verdict:** ${report.qaVerdict}\n\n**AI recommended verdict:** ${report.aiRecommendedVerdict}\n\n**Human review required:** ${report.humanReviewRequired ? 'Yes' : 'No'}\n\n## Stages\n\n${Object.entries(report.stageResults).map(([name, status]) => `- ${name}: ${status}`).join('\n')}\n\n## Requirements\n\n${report.requirements.length ? report.requirements.map(item => `- ${item.id}: ${item.description} (${item.source.origin}: ${item.source.reference})`).join('\n') : 'No requirements were extracted.'}\n\n## Acceptance Criteria\n\n${report.acceptanceCriteria.length ? report.acceptanceCriteria.map(item => `- ${item.id}: ${item.status} — ${item.description}`).join('\n') : 'No acceptance criteria were extracted.'}\n\n## Findings\n\n${report.findings.length ? report.findings.map(item => `- [${item.severity}] [${item.verificationStatus}] ${item.id}: ${item.title} — ${item.description}`).join('\n') : 'No findings were reported by the validated audit.'}\n\n## Test Scenarios\n\n${report.testScenarios.length ? report.testScenarios.map(item => `- ${item.id}: ${item.title} (${item.executionStatus}, ${item.recommendedExecutor})`).join('\n') : 'No test scenarios were proposed.'}\n\n## Limitations\n\n${report.limitations.length ? report.limitations.map(item => `- ${item}`).join('\n') : 'None.'}\n`; }
