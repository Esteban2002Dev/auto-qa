import { createQaOrchestrator } from '../../bootstrap/container.js'; import { issueKeyFromArgs, fail } from './common.js';
try { const context = await createQaOrchestrator().collect(issueKeyFromArgs()); console.log(JSON.stringify({ ticket: context.issue, parent: context.parent, comments: context.comments, pullRequests: context.pullRequestUrls }, null, 2)); } catch (error) { fail(error); }
