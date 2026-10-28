import type { IssueTrackerPort } from './ports.js';
import type { TicketContext } from '../domain/entities.js';
import { canonicalizePullRequestReferences, extractPullRequestReferences, type RepositoryAliases } from './pull-request-url.js';

export async function collectTicketContext(issueKey: string, tracker: IssueTrackerPort, aliases: RepositoryAliases = {}): Promise<TicketContext> {
  const issue = await tracker.getIssue(issueKey);
  const [comments, parent, developmentReferences] = await Promise.all([tracker.getComments(issue.key), tracker.getParentIssue(issue), tracker.getDevelopmentPullRequestReferences?.(issue).catch(() => []) ?? []]);
  const references = canonicalizePullRequestReferences([
    ...extractPullRequestReferences(issue.metadata.pullRequestFieldValue ?? '', 'JIRA_FIELD', issue.metadata.pullRequestFieldId ?? 'unknown', aliases),
    ...extractPullRequestReferences(issue.description, 'JIRA_DESCRIPTION', `issue:${issue.key}:description`, aliases),
    ...comments.flatMap(comment => extractPullRequestReferences(comment.text, 'JIRA_COMMENT', `comment:${comment.id}`, aliases)),
    ...developmentReferences
  ]);
  return { issue, comments, parent, pullRequestReferences: references, pullRequestUrls: references.flatMap(reference => reference.url ? [reference.url] : []) };
}
