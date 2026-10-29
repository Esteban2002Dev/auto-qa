import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { IssueTrackerPort, ReportStoragePort, WebhookHistoryPort } from '../ports.js';
import type { QaOrchestrator } from './qa-orchestrator.js';
import type { WebhookEvent, WebhookJob, WebhookMode, WebhookTrigger } from '../../domain/webhook.js';
import { renderJiraQaPlanComment } from '../jira-comment-adf.js';
import type { JiraCommentPublisher } from '../jira-comment-publisher.js';
import { Logger } from '../../infrastructure/logging/logger.js';

const NativePayloadSchema = z.object({ webhookEvent: z.string(), timestamp: z.number().optional(), issue: z.object({ id: z.string(), key: z.string() }), comment: z.object({ id: z.string(), body: z.unknown().optional(), author: z.object({ accountId: z.string().optional() }).optional() }).optional(), changelog: z.object({ id: z.string().optional(), items: z.array(z.object({ field: z.string(), fromString: z.string().nullable().optional(), toString: z.string().nullable().optional() })).default([]) }).optional() });
const StudioPayloadSchema = z.object({ source: z.enum(['atlassian_studio', 'jira_automation']), event: z.literal('issue_updated'), issueKey: z.string().min(1), issueId: z.string().min(1) });
export const JiraWebhookPayloadSchema = z.union([NativePayloadSchema, StudioPayloadSchema]);
export type JiraWebhookPayload = z.infer<typeof JiraWebhookPayloadSchema>;
export interface WebhookSettings { mode: WebhookMode; publishPlans?: boolean; projectKey: string; status: string; assigneeAccountIds: string[]; commandAllowedAccountIds: string[]; }

export class JiraWebhookService {
  constructor(private readonly tracker: IssueTrackerPort, private readonly history: WebhookHistoryPort, private readonly settings: WebhookSettings, private readonly orchestrator?: QaOrchestrator, private readonly reports?: ReportStoragePort, private readonly publisher?: JiraCommentPublisher, private readonly logger = new Logger()) {}

  async accept(payload: JiraWebhookPayload, rawBody: Buffer, deliveryId?: string): Promise<{ accepted: boolean; duplicate: boolean; reason: string }> {
    const trigger = this.trigger(payload);
    if (!trigger) { this.logger.info('Event ignored', { component: 'TRIGGER', ticketKey: this.issueKey(payload), reason: 'ignored event' }); return { accepted: false, duplicate: false, reason: 'ignored event' }; }
    const issue = await this.tracker.getIssue(this.issueKey(payload));
    const command = trigger === 'MANUAL_COMMENT';
    const eligible = command ? this.commandAllowed(payload) : issue.metadata.projectKey === this.settings.projectKey && issue.status === this.settings.status && (this.settings.assigneeAccountIds.length === 0 || this.settings.assigneeAccountIds.includes(issue.metadata.assigneeAccountId ?? ''));
    if (!eligible) { this.logger.info('Ticket not eligible', { component: 'TRIGGER', ticketKey: issue.key, triggerType: trigger, status: issue.status, assignee: issue.metadata.assigneeAccountId }); return { accepted: false, duplicate: false, reason: 'ticket is not eligible' }; }
    const transition = command ? null : await this.latestQaTransition(issue.key);
    if (!command && !transition) { this.logger.warn('QA cycle not found', { component: 'TRIGGER', ticketKey: issue.key }); return { accepted: false, duplicate: false, reason: 'QA transition was not found in Jira history' }; }
    const occurredAt = transition?.occurredAt ?? new Date().toISOString();
    const eventId = deliveryId ? `jira:${deliveryId}` : createHash('sha256').update(rawBody).digest('hex');
    const cycleId = command ? `comment:${this.commentId(payload)}` : `transition:${transition!.id}`;
    const event: WebhookEvent = { eventId, receivedAt: new Date().toISOString(), occurredAt, ticketKey: issue.key, ticketId: this.issueId(payload), trigger, cycleId, assigneeAccountId: issue.metadata.assigneeAccountId ?? null };
    if (!this.history.recordEvent(event)) { this.logger.info('Duplicate webhook event', { component: 'TRIGGER', ticketKey: issue.key, qaCycleId: cycleId, correlationId: eventId }); return { accepted: true, duplicate: true, reason: 'duplicate event' }; }
    const job: WebhookJob = { id: randomUUID(), eventId, ticketKey: issue.key, cycleId, trigger, mode: this.settings.mode, status: 'PENDING', createdAt: new Date().toISOString(), startedAt: null, completedAt: null, executionId: null, reportPath: null, planPath: null, jiraCommentId: null, error: null };
    if (!this.history.enqueue(job)) { this.logger.info('Duplicate QA cycle', { component: 'TRIGGER', ticketKey: issue.key, qaCycleId: cycleId, correlationId: eventId }); return { accepted: true, duplicate: true, reason: 'duplicate cycle' }; }
    this.logger.info(this.settings.mode === 'debug' ? 'AUDIT_SKIPPED: DEBUG_MODE' : 'Audit job queued', { component: 'WORKER', ticketKey: issue.key, qaCycleId: cycleId, triggerType: trigger, correlationId: eventId, jobId: job.id });
    queueMicrotask(() => void this.processNext());
    return { accepted: true, duplicate: false, reason: this.settings.mode === 'debug' ? 'would run audit' : 'audit queued' };
  }

  async processNext(): Promise<void> { const job = this.history.claimNext(); if (!job) return; const started = performance.now(); const log = this.logger.child({ component: 'WORKER', ticketKey: job.ticketKey, qaCycleId: job.cycleId, triggerType: job.trigger, correlationId: job.eventId }); log.info('QA execution started', { jobId: job.id }); try { if (job.mode === 'debug') { this.history.complete(job.id, 'SIMULATED', {}); log.info('AUDIT_SKIPPED: DEBUG_MODE', { status: 'SIMULATED' }); } else if (!this.orchestrator || !this.reports) { this.history.complete(job.id, 'BLOCKED', { error: 'Audit worker is unavailable' }); log.warn('QA execution blocked', { status: 'BLOCKED' }); } else { const result = await this.orchestrator.audit(job.ticketKey); log.info('Audit plan generated', { executionId: result.report.executionId, scenarios: result.report.testScenarios.length, executionStatus: result.report.executionStatus }); const paths = await this.orchestrator.save(result.report, result.markdown); const status = result.report.executionStatus === 'BLOCKED' ? 'BLOCKED' : result.report.executionStatus === 'FAILED' ? 'FAILED' : 'COMPLETED'; this.history.complete(job.id, status, { executionId: result.report.executionId, reportPath: paths.jsonPath, planPath: paths.jsonPath }); log.info('QA report persisted', { executionId: result.report.executionId, status, reportPath: paths.jsonPath }); if (status === 'COMPLETED' && this.settings.publishPlans && this.publisher) try { log.info('Jira publication started', { executionId: result.report.executionId }); const published = await this.publisher.publishComment(job.ticketKey, result.report.executionId, renderJiraQaPlanComment(result.report)); log.info('Jira publication completed', { executionId: result.report.executionId, commentId: published.commentId }); } catch (error) { this.history.complete(job.id, 'COMPLETED', { error: `Jira publication failed: ${error instanceof Error ? error.message : 'Unknown error'}` }); log.error('Jira publication failed', { executionId: result.report.executionId, error: error instanceof Error ? error.message : 'Unknown error', recoverable: true }); } else log.info('Jira publication skipped', { enabled: Boolean(this.settings.publishPlans && this.publisher) }); } } catch (error) { this.history.complete(job.id, 'FAILED', { error: error instanceof Error ? error.message : 'Unknown audit error' }); log.error('QA execution failed', { status: 'FAILED', error: error instanceof Error ? error.message : 'Unknown error' }); } finally { log.info('QA execution finished', { durationMs: Math.round(performance.now() - started) }); queueMicrotask(() => void this.processNext()); } }

  private async latestQaTransition(issueKey: string): Promise<{ id: string; occurredAt: string } | null> { if (!this.tracker.getLatestStatusTransition) throw new Error('Issue tracker does not support Jira changelog lookup'); return this.tracker.getLatestStatusTransition(issueKey, this.settings.status); }
  private trigger(payload: JiraWebhookPayload): WebhookTrigger | null { if (this.isStudioPayload(payload)) return 'QA_TRANSITION'; if (payload.comment && this.isAutoQaComment(payload.comment.body)) return null; if (payload.comment && this.commandAllowed(payload)) return 'MANUAL_COMMENT'; const fields = payload.changelog?.items.map(item => item.field.toLowerCase()) ?? []; if (fields.includes('status')) return 'QA_TRANSITION'; if (fields.includes('assignee')) return 'QA_ASSIGNMENT'; return null; }
  private issueKey(payload: JiraWebhookPayload): string { return this.isStudioPayload(payload) ? payload.issueKey : payload.issue.key; }
  private issueId(payload: JiraWebhookPayload): string { return this.isStudioPayload(payload) ? payload.issueId : payload.issue.id; }
  private commentId(payload: JiraWebhookPayload): string { return this.isStudioPayload(payload) ? '' : payload.comment?.id ?? ''; }
  private isStudioPayload(payload: JiraWebhookPayload): payload is z.infer<typeof StudioPayloadSchema> { return 'source' in payload; }
  private isAutoQaComment(value: unknown): boolean { return typeof value === 'string' ? /\[AUTO-QA:[^\]]+\]/.test(value) : Array.isArray(value) ? value.some(item => this.isAutoQaComment(item)) : value !== null && typeof value === 'object' ? Object.values(value).some(item => this.isAutoQaComment(item)) : false; }
  private commandAllowed(payload: JiraWebhookPayload): boolean { if (this.isStudioPayload(payload)) return false; const body = typeof payload.comment?.body === 'string' ? payload.comment.body.trim() : ''; const author = payload.comment?.author?.accountId; return /^@auto-qa review$/im.test(body) && Boolean(author && this.settings.commandAllowedAccountIds.includes(author)); }
}
