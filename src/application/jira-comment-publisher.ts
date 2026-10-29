import type { JiraCommentDocument, JiraCommentPublisherPort, JiraPublishedComment, WebhookHistoryPort } from './ports.js';

export const autoQaCommentMarker = (executionId: string): string => `[AUTO-QA:${executionId}]`;
export type JiraCommentPublishResult = { mode: 'dry-run' | 'published' | 'updated'; commentId: string | null; content: JiraCommentDocument };

export class JiraCommentPublisher {
  constructor(private readonly publisher: JiraCommentPublisherPort, private readonly history: WebhookHistoryPort, private readonly publishingEnabled = false) {}
  async publishComment(ticketKey: string, executionId: string, content: JiraCommentDocument, dryRun = false): Promise<JiraCommentPublishResult> {
    this.assertMarker(executionId, content);
    if (dryRun) return { mode: 'dry-run', commentId: null, content };
    this.assertEnabled(); await this.assertCreatePermission(ticketKey);
    const job = this.jobForExecution(ticketKey, executionId);
    if (job.jiraCommentId) return { mode: 'published', commentId: job.jiraCommentId, content };
    const published = await this.publisher.publishComment(ticketKey, content);
    this.linkComment(executionId, published.id);
    return { mode: 'published', commentId: published.id, content };
  }
  async updateComment(ticketKey: string, executionId: string, content: JiraCommentDocument, dryRun = false): Promise<JiraCommentPublishResult> {
    this.assertMarker(executionId, content);
    if (dryRun) return { mode: 'dry-run', commentId: null, content };
    this.assertEnabled(); const job = this.jobForExecution(ticketKey, executionId);
    if (!job.jiraCommentId) throw new Error(`No Jira comment is associated with execution ${executionId}`);
    const [permissions, currentUser, comment] = await Promise.all([this.publisher.checkCommentPermissions(ticketKey), this.publisher.getCurrentUserAccountId(), this.publisher.getComment(ticketKey, job.jiraCommentId)]);
    if (!permissions.canEditOwn) throw new Error('Jira permission EDIT_OWN_COMMENTS is required');
    if (!comment.authorAccountId || comment.authorAccountId !== currentUser) throw new Error('Auto-QA may only update its own Jira comment');
    const updated = await this.publisher.updateComment(ticketKey, job.jiraCommentId, content);
    return { mode: 'updated', commentId: updated.id, content };
  }
  private assertEnabled(): void { if (!this.publishingEnabled) throw new Error('Jira comment publishing is disabled'); }
  private async assertCreatePermission(ticketKey: string): Promise<void> { const permissions = await this.publisher.checkCommentPermissions(ticketKey); if (!permissions.canCreate) throw new Error('Jira permission ADD_COMMENTS is required'); }
  private assertMarker(executionId: string, content: JiraCommentDocument): void { if (!JSON.stringify(content).includes(autoQaCommentMarker(executionId))) throw new Error(`Jira comment must include ${autoQaCommentMarker(executionId)}`); }
  private jobForExecution(ticketKey: string, executionId: string) { const job = this.history.getJobByExecutionId?.(executionId); if (!job || job.ticketKey !== ticketKey) throw new Error(`No QA execution is associated with ${ticketKey}/${executionId}`); return job; }
  private linkComment(executionId: string, commentId: string): void { if (!this.history.linkJiraComment?.(executionId, commentId)) throw new Error(`Could not associate Jira comment ${commentId} with execution ${executionId}`); }
}
