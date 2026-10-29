import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { IssueTrackerPort, ReportStoragePort, WebhookHistoryPort } from '../ports.js';
import type { QaOrchestrator } from './qa-orchestrator.js';
import type { WebhookEvent, WebhookJob, WebhookMode, WebhookTrigger } from '../../domain/webhook.js';

const NativePayloadSchema = z.object({ webhookEvent: z.string(), timestamp: z.number().optional(), issue: z.object({ id: z.string(), key: z.string() }), comment: z.object({ id: z.string(), body: z.unknown().optional(), author: z.object({ accountId: z.string().optional() }).optional() }).optional(), changelog: z.object({ id: z.string().optional(), items: z.array(z.object({ field: z.string(), fromString: z.string().nullable().optional(), toString: z.string().nullable().optional() })).default([]) }).optional() });
const StudioPayloadSchema = z.object({ source: z.enum(['atlassian_studio', 'jira_automation']), event: z.literal('issue_updated'), issueKey: z.string().min(1), issueId: z.string().min(1) });
export const JiraWebhookPayloadSchema = z.union([NativePayloadSchema, StudioPayloadSchema]);
export type JiraWebhookPayload = z.infer<typeof JiraWebhookPayloadSchema>;
export interface WebhookSettings { mode: WebhookMode; projectKey: string; status: string; assigneeAccountIds: string[]; commandAllowedAccountIds: string[]; }

export class JiraWebhookService {
  constructor(private readonly tracker: IssueTrackerPort, private readonly history: WebhookHistoryPort, private readonly settings: WebhookSettings, private readonly orchestrator?: QaOrchestrator, private readonly reports?: ReportStoragePort) {}

  async accept(payload: JiraWebhookPayload, rawBody: Buffer, deliveryId?: string): Promise<{ accepted: boolean; duplicate: boolean; reason: string }> {
    const trigger = this.trigger(payload);
    if (!trigger) return { accepted: false, duplicate: false, reason: 'ignored event' };
    const issue = await this.tracker.getIssue(this.issueKey(payload));
    const command = trigger === 'MANUAL_COMMENT';
    const eligible = command ? this.commandAllowed(payload) : issue.metadata.projectKey === this.settings.projectKey && issue.status === this.settings.status && (this.settings.assigneeAccountIds.length === 0 || this.settings.assigneeAccountIds.includes(issue.metadata.assigneeAccountId ?? ''));
    if (!eligible) return { accepted: false, duplicate: false, reason: 'ticket is not eligible' };
    const transition = command ? null : await this.latestQaTransition(issue.key);
    if (!command && !transition) return { accepted: false, duplicate: false, reason: 'QA transition was not found in Jira history' };
    const occurredAt = transition?.occurredAt ?? new Date().toISOString();
    const eventId = deliveryId ? `jira:${deliveryId}` : createHash('sha256').update(rawBody).digest('hex');
    const cycleId = command ? `comment:${this.commentId(payload)}` : `transition:${transition!.id}`;
    const event: WebhookEvent = { eventId, receivedAt: new Date().toISOString(), occurredAt, ticketKey: issue.key, ticketId: this.issueId(payload), trigger, cycleId, assigneeAccountId: issue.metadata.assigneeAccountId ?? null };
    if (!this.history.recordEvent(event)) return { accepted: true, duplicate: true, reason: 'duplicate event' };
    const job: WebhookJob = { id: randomUUID(), eventId, ticketKey: issue.key, cycleId, trigger, mode: this.settings.mode, status: 'PENDING', createdAt: new Date().toISOString(), startedAt: null, completedAt: null, executionId: null, reportPath: null, error: null };
    if (!this.history.enqueue(job)) return { accepted: true, duplicate: true, reason: 'duplicate cycle' };
    queueMicrotask(() => void this.processNext());
    return { accepted: true, duplicate: false, reason: this.settings.mode === 'debug' ? 'would run audit' : 'audit queued' };
  }

  async processNext(): Promise<void> { const job = this.history.claimNext(); if (!job) return; try { if (job.mode === 'debug') this.history.complete(job.id, 'SIMULATED', {}); else if (!this.orchestrator || !this.reports) this.history.complete(job.id, 'BLOCKED', { error: 'Audit worker is unavailable' }); else { const result = await this.orchestrator.audit(job.ticketKey); const paths = await this.orchestrator.save(result.report, result.markdown); this.history.complete(job.id, result.report.executionStatus === 'BLOCKED' ? 'BLOCKED' : result.report.executionStatus === 'FAILED' ? 'FAILED' : 'COMPLETED', { executionId: result.report.executionId, reportPath: paths.jsonPath }); } } catch (error) { this.history.complete(job.id, 'FAILED', { error: error instanceof Error ? error.message : 'Unknown audit error' }); } finally { queueMicrotask(() => void this.processNext()); } }

  private async latestQaTransition(issueKey: string): Promise<{ id: string; occurredAt: string } | null> { if (!this.tracker.getLatestStatusTransition) throw new Error('Issue tracker does not support Jira changelog lookup'); return this.tracker.getLatestStatusTransition(issueKey, this.settings.status); }
  private trigger(payload: JiraWebhookPayload): WebhookTrigger | null { if (this.isStudioPayload(payload)) return 'QA_TRANSITION'; if (payload.comment && this.commandAllowed(payload)) return 'MANUAL_COMMENT'; const fields = payload.changelog?.items.map(item => item.field.toLowerCase()) ?? []; if (fields.includes('status')) return 'QA_TRANSITION'; if (fields.includes('assignee')) return 'QA_ASSIGNMENT'; return null; }
  private issueKey(payload: JiraWebhookPayload): string { return this.isStudioPayload(payload) ? payload.issueKey : payload.issue.key; }
  private issueId(payload: JiraWebhookPayload): string { return this.isStudioPayload(payload) ? payload.issueId : payload.issue.id; }
  private commentId(payload: JiraWebhookPayload): string { return this.isStudioPayload(payload) ? '' : payload.comment?.id ?? ''; }
  private isStudioPayload(payload: JiraWebhookPayload): payload is z.infer<typeof StudioPayloadSchema> { return 'source' in payload; }
  private commandAllowed(payload: JiraWebhookPayload): boolean { if (this.isStudioPayload(payload)) return false; const body = typeof payload.comment?.body === 'string' ? payload.comment.body.trim() : ''; const author = payload.comment?.author?.accountId; return /^@auto-qa review$/im.test(body) && Boolean(author && this.settings.commandAllowedAccountIds.includes(author)); }
}
