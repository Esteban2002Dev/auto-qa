const githubPr = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/(\d+)(?:[/?#].*)?$/;

export function extractPullRequestUrls(text: string): string[] {
  const candidates = text.match(/https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+(?:[/?#][^\s<]*)?/g) ?? [];
  return [...new Set(candidates.map(url => url.replace(/[).,;]+$/, '')).filter(url => githubPr.test(url)))];
}

export function parsePullRequestUrl(url: string): { owner: string; repo: string; number: number } {
  const found = githubPr.exec(url);
  if (!found) throw new Error('Invalid GitHub pull request URL');
  return { owner: found[1], repo: found[2], number: Number(found[3]) };
}
