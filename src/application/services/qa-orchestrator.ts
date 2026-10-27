import { randomUUID } from 'node:crypto';
import type { AiAgentPort, IssueTrackerPort, ReportStoragePort, SourceControlPort, TestExecutorPort } from '../ports.js';
import type { PullRequest, QaFinding, QaReport, QaExecutionStatus, TestExecutionResult, TicketContext } from '../../domain/entities.js';
import { collectTicketContext } from '../use-cases.js';

const initialStages = (): Record<string, QaExecutionStatus> => ({ COLLECT_CONTEXT: 'PENDING', REVIEW_CODE: 'PENDING', PLAN_TESTS: 'PENDING', EXECUTE_TESTS: 'PENDING', GENERATE_REPORT: 'PENDING' });
const asFinding = (title: string, description: string, kind: QaFinding['kind']): QaFinding => ({ title, description, kind, severity: kind === 'INFRASTRUCTURE_FAILURE' ? 'MEDIUM' : 'LOW', evidence: [] });

export class QaOrchestrator {
  constructor(private readonly tracker: IssueTrackerPort, private readonly sourceControl: SourceControlPort, private readonly ai: AiAgentPort, private readonly tests: TestExecutorPort, private readonly storage: ReportStoragePort) {}
  async collect(issueKey: string): Promise<TicketContext> { return collectTicketContext(issueKey, this.tracker); }
  async audit(issueKey: string, executeTests = false): Promise<{ report: QaReport; markdown: string }> {
    const stages = initialStages(); const findings: QaFinding[] = []; let context: TicketContext;
    try { context = await this.collect(issueKey); stages.COLLECT_CONTEXT = 'PASSED'; } catch (error) { stages.COLLECT_CONTEXT = 'FAILED'; throw error; }
    const prs: PullRequest[] = [];
    for (const url of context.pullRequestUrls) try { prs.push(await this.sourceControl.getPullRequest(url)); } catch (error) { findings.push(asFinding('PR no accesible', errorMessage(error), 'MISSING_INFORMATION')); }
    stages.REVIEW_CODE = context.pullRequestUrls.length === 0 ? 'SKIPPED' : 'PASSED';
    let agentReport = '';
    try { const answer = await this.ai.audit({ ticket: context.issue.key, context: JSON.stringify({ issue: context.issue, parent: context.parent, comments: context.comments }), pullRequests: prs }); agentReport = answer.report; stages.PLAN_TESTS = 'PASSED'; } catch (error) { stages.PLAN_TESTS = 'BLOCKED'; findings.push(asFinding('Auditor de IA no disponible', errorMessage(error), 'INFRASTRUCTURE_FAILURE')); }
    let testResults: TestExecutionResult[] = [];
    if (executeTests) { try { testResults = await this.tests.execute({}); stages.EXECUTE_TESTS = testResults.some(x => x.status === 'FAILED') ? 'FAILED' : 'PASSED'; } catch (error) { stages.EXECUTE_TESTS = 'FAILED'; findings.push(asFinding('Ejecución de pruebas falló', errorMessage(error), 'INFRASTRUCTURE_FAILURE')); } } else stages.EXECUTE_TESTS = 'SKIPPED';
    stages.GENERATE_REPORT = 'PASSED'; const status: QaExecutionStatus = Object.values(stages).includes('FAILED') ? 'FAILED' : Object.values(stages).includes('BLOCKED') ? 'BLOCKED' : 'PASSED';
    const report: QaReport = { ticketKey: context.issue.key, summary: context.issue.summary, executionId: randomUUID(), status, findings, testResults, evidence: [], generatedAt: new Date().toISOString(), stages };
    return { report, markdown: renderMarkdown(report, context, agentReport) };
  }
  async save(report: QaReport, markdown: string) { return this.storage.save(report, markdown); }
}
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Error desconocido';
export function renderMarkdown(report: QaReport, context: TicketContext, agentReport: string): string { return `# Reporte QA: ${report.ticketKey}\n\n**Estado:** ${report.status}\n\n## Ticket\n\n${context.issue.summary}\n\n${context.issue.description}\n\n## Etapas\n\n${Object.entries(report.stages).map(([k,v]) => `- ${k}: ${v}`).join('\n')}\n\n## Hallazgos\n\n${report.findings.length ? report.findings.map(x => `- [${x.severity}] ${x.title}: ${x.description}`).join('\n') : 'Sin hallazgos confirmados.'}\n\n## Plan del auditor\n\n${agentReport || 'No disponible; requiere revisión humana.'}\n`; }
