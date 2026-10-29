export type WebhookMode = 'debug' | 'audit';
export type WebhookTrigger = 'QA_TRANSITION' | 'QA_ASSIGNMENT' | 'MANUAL_COMMENT';
export type WebhookJobStatus = 'PENDING' | 'RUNNING' | 'SIMULATED' | 'COMPLETED' | 'FAILED' | 'BLOCKED';
export interface WebhookEvent { eventId: string; receivedAt: string; occurredAt: string; ticketKey: string; ticketId: string; trigger: WebhookTrigger; cycleId: string; assigneeAccountId: string | null; }
export interface WebhookJob { id: string; eventId: string; ticketKey: string; cycleId: string; trigger: WebhookTrigger; mode: WebhookMode; status: WebhookJobStatus; createdAt: string; startedAt: string | null; completedAt: string | null; executionId: string | null; reportPath: string | null; planPath: string | null; jiraCommentId: string | null; error: string | null; }
