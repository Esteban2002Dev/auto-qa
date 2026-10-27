import type { IssueTrackerPort } from './ports.js';
import type { TicketContext } from '../domain/entities.js';
import { extractPullRequestUrls } from './pull-request-url.js';

export async function collectTicketContext(issueKey: string, tracker: IssueTrackerPort): Promise<TicketContext> {
  const issue = await tracker.getIssue(issueKey);
  const [comments, parent] = await Promise.all([tracker.getComments(issue.key), tracker.getParentIssue(issue)]);
  return { issue, comments, parent, pullRequestUrls: extractPullRequestUrls([issue.description, ...comments.map(({ text }) => text)].join('\n')) };
}
