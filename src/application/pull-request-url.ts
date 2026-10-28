import type { PullRequestReference, PullRequestReferenceSource } from '../domain/entities.js';

export type RepositoryAliases = Readonly<Record<string, string>>;
const defaultRepositoryAliases: RepositoryAliases = {
  'vivook-nest-api': 'AGS-Vivook/vivook-nest-api',
  'vivook-angular': 'AGS-Vivook/vivook-angular',
  'angular-vivook': 'AGS-Vivook/vivook-angular',
  'vivook2020-node': 'AGS-Vivook/vivook2020-node',
  'crm-nest': 'AGS-Vivook/crm-nest',
  'crm-angular': 'AGS-Vivook/crm-angular',
  'vivook-whatsapp': 'AGS-Vivook/vivook-whatsapp',
  'vivook-qa': 'AGS-Vivook/Vivook-QA',
  'vivook-web': 'AGS-Vivook/vivook-web',
  'vivook-agents': 'AGS-Vivook/vivook-agents'
};
const fullUrl = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/(\d+)(?:[/?#].*)?$/;
const shortReference = /(?:^|[\s(])([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?)#(\d+)\b/g;
const completeUrl = /https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+(?:[/?#][^\s<]*)?/g;

export function repositoryAliasesFromEnv(value: string | undefined): RepositoryAliases { const aliases: Record<string, string> = { ...defaultRepositoryAliases }; for (const item of (value ?? '').split(',')) { const [alias, repository] = item.split('=').map(part => part.trim()); if (alias && repository && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) aliases[alias.toLowerCase()] = repository; } return aliases; }
export function parsePullRequestUrl(url: string): { owner: string; repo: string; number: number } { const found = fullUrl.exec(url); if (!found) throw new Error('Invalid GitHub pull request URL'); return { owner: found[1], repo: found[2], number: Number(found[3]) }; }
export function extractPullRequestReferences(text: string, source: PullRequestReferenceSource, sourceReference: string, aliases: RepositoryAliases = {}): PullRequestReference[] {
  const references: PullRequestReference[] = []; for (const match of text.match(completeUrl) ?? []) { const raw = match.replace(/[).,;]+$/, ''); const { owner, repo, number } = parsePullRequestUrl(raw); references.push({ raw, source, sourceReference, owner, repository: repo, number, url: `https://github.com/${owner}/${repo}/pull/${number}` }); }
  for (const match of text.matchAll(shortReference)) { const raw = `${match[1]}#${match[2]}`; const [ownerOrAlias, explicitRepository] = match[1].split('/'); const mapped = explicitRepository ? match[1] : aliases[ownerOrAlias.toLowerCase()]; const [owner, repository] = mapped?.split('/') ?? []; const number = Number(match[2]); references.push({ raw, source, sourceReference, owner: owner ?? null, repository: repository ?? null, number: Number.isSafeInteger(number) && number > 0 ? number : null, url: owner && repository && number > 0 ? `https://github.com/${owner}/${repository}/pull/${number}` : null }); }
  return references;
}
export function canonicalizePullRequestReferences(references: PullRequestReference[]): PullRequestReference[] { const seen = new Set<string>(); return references.filter(reference => { const key = reference.owner && reference.repository && reference.number ? `${reference.owner.toLowerCase()}/${reference.repository.toLowerCase()}#${reference.number}` : `unresolved:${reference.raw.toLowerCase()}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
export function extractPullRequestUrls(text: string): string[] { return canonicalizePullRequestReferences(extractPullRequestReferences(text, 'JIRA_DESCRIPTION', 'text')).flatMap(reference => reference.url ? [reference.url] : []); }
