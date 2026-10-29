import { jiraEnv } from '../../infrastructure/config/env.js';
import { JiraCommentPublisherAdapter } from '../../infrastructure/integrations/jira/jira-comment-publisher.adapter.js';

try {
  const ticketKey = process.argv[2];
  if (!ticketKey) throw new Error('Usage: npm run qa:jira-publish-auth -- <TICKET-KEY>');
  const env = jiraEnv();
  const publisher = new JiraCommentPublisherAdapter(env);
  const result = await publisher.diagnoseAuthentication(ticketKey);
  console.log(result.authenticated ? `Jira publishing diagnostic verified: canCreate=${result.canCreate} canEditOwn=${result.canEditOwn} canReadComments=${result.canReadComments}` : 'Jira publishing authentication diagnostic failed');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Jira publishing authentication diagnostic failed');
  process.exitCode = 1;
}
