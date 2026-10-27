
import 'dotenv/config';

const {
    JIRA_BASE_URL,
    JIRA_CLOUD_ID,
    JIRA_EMAIL,
    JIRA_API_TOKEN
} = process.env;

const ticket = process.argv[2]?.toUpperCase();

if (!JIRA_CLOUD_ID || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    throw new Error('Faltan credenciales de Jira en .env');
}

if (!/^AGSVK-\d+$/.test(ticket ?? '')) {
    throw new Error('Uso: node scripts/jira-client.mjs AGSVK-123');
}

const base = `https://api.atlassian.com/ex/jira/${JIRA_CLOUD_ID}`;
const auth = Buffer.from(
    `${JIRA_EMAIL}:${JIRA_API_TOKEN}`
).toString('base64');

async function jiraGet(path) {
    const response = await fetch(`${base}${path}`, {
        headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(
            `Jira HTTP ${response.status}: ${path}`
        );
    }

    return response.json();
}

// Convierte los nodos ADF de Jira a texto legible.
function adfToText(node) {
    if (!node) return '';
    if (typeof node === 'string') return node;

    let result = node.text ?? '';

    if (node.type === 'inlineCard' && node.attrs?.url) {
        result += node.attrs.url;
    }

    if (node.type === 'hardBreak') result += '\n';

    if (Array.isArray(node.content)) {
        result += node.content.map(adfToText).join('');
    }

    if (['paragraph', 'heading', 'listItem'].includes(node.type)) {
        result += '\n';
    }

    return result;
}

async function getComments(key) {
    const comments = [];
    let startAt = 0;

    while (true) {
        const data = await jiraGet(
            `/rest/api/3/issue/${key}/comment?startAt=${startAt}&maxResults=100`
        );

        comments.push(...data.comments);

        startAt += data.comments.length;

        if (startAt >= data.total || data.comments.length === 0) {
            break;
        }
    }

    return comments.map(comment => ({
        author: comment.author?.displayName,
        created: comment.created,
        text: adfToText(comment.body).trim()
    }));
}

async function getIssue(key) {
    const issue = await jiraGet(
        `/rest/api/3/issue/${key}?fields=summary,description,status,issuetype,priority,parent`
    );

    return {
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status?.name,
        type: issue.fields.issuetype?.name,
        priority: issue.fields.priority?.name,
        parentKey: issue.fields.parent?.key ?? null,
        description: adfToText(issue.fields.description).trim()
    };
}

try {
    const issue = await getIssue(ticket);
    const comments = await getComments(ticket);

    let parent = null;

    if (issue.parentKey) {
        parent = await getIssue(issue.parentKey);
    }

    const text = [
        issue.description,
        ...comments.map(comment => comment.text)
    ].join('\n');

    const pullRequests = [
        ...new Set(
            text.match(
                /https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/g
            ) ?? []
        )
    ];

    const result = {
        ticket: issue,
        parent,
        comments,
        pullRequests,
        jiraUrl: `${JIRA_BASE_URL}/browse/${ticket}`
    };

    console.log(JSON.stringify({
        ticket: issue.key,
        status: issue.status,
        description: issue.description,
        type: issue.type,
        parent: parent?.key ?? null,
        commentsFound: comments.length,
        pullRequestsFound: pullRequests.length
    }, null, 2));

} catch (error) {
    console.error('Error:', error.message);
    process.exitCode = 1;
}
