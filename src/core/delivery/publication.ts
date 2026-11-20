import { z } from 'zod';
import type { GitProvider } from '../project-git.js';
import { configuredToken } from '../agent-config.js';

const reviewResponse = z.object({
  html_url: z.string().nullish(), web_url: z.string().nullish(), number: z.number().optional(), iid: z.number().optional(),
  head: z.object({ sha: z.string().optional(), ref: z.string().optional() }).nullish(),
  base: z.object({ ref: z.string().optional() }).nullish(),
  source_branch: z.string().optional(), target_branch: z.string().optional(),
  sha: z.string().nullish(), diff_refs: z.object({ head_sha: z.string().nullish() }).nullish(),
});

export async function publicationToken(provider: GitProvider, projectPath?: string): Promise<string> {
  const key = provider === 'github' ? 'GITHUB_TOKEN' : 'GONGFENG_TOKEN';
  const token = (projectPath && await configuredToken(projectPath, key)) || process.env[key] ||
    (provider === 'github' ? process.env.GH_TOKEN : undefined);
  if (!token?.trim() || /\s/.test(token)) {
    throw new Error(`Set ${key} in local agent.config or the environment before publishing.`);
  }
  return token;
}

interface ReviewRequest {
  provider: GitProvider;
  repository: string;
  branch: string;
  target: string;
  commit: string;
  title: string;
  description: string;
}

export async function openReviewRequest(request: ReviewRequest, token: string): Promise<{ url: string; verifySource: boolean } | { reason: string }> {
  const { provider, repository, branch, target, commit, title, description } = request;
  const github = provider === 'github';
  const repoPath = repository.split('/').map(encodeURIComponent).join('/');
  const endpoint = github ? `https://api.github.com/repos/${repoPath}/pulls`
    : `https://git.code.tencent.com/api/v3/projects/${encodeURIComponent(repository)}/merge_requests`;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'KeaveAI',
        Accept: github ? 'application/vnd.github+json' : 'application/json',
        ...(github ? { Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' } : { 'PRIVATE-TOKEN': token }),
      },
      body: JSON.stringify(github ? { head: branch, base: target, title, body: description }
        : { source_branch: branch, target_branch: target, title, description }),
    });
    if (!response.ok) return { reason: `The review API returned HTTP ${response.status}. Check the remote project before retrying manually.` };
    const result = reviewResponse.parse(await response.json());
    const host = github ? 'github.com' : 'git.code.tencent.com';
    const number = github ? result.number : result.iid;
    const defaultUrl = typeof number === 'number' && Number.isSafeInteger(number) && number > 0
      ? `https://${host}/${repoPath}/${github ? 'pull' : 'merge_requests'}/${number}` : undefined;
    const link = (github ? result.html_url : result.web_url) ?? defaultUrl;
    if (!link) return { reason: 'The API response did not include a confirmed PR/MR link or number.' };
    const url = new URL(link);
    const route = url.pathname.slice(repoPath.length + 2);
    const validRoute = github ? /^pull\/[1-9]\d*$/ : /^(?:-\/)?merge_requests\/[1-9]\d*$/;
    const samePath = github ? url.pathname.toLowerCase().startsWith(`/${repoPath.toLowerCase()}/`) : url.pathname.startsWith(`/${repoPath}/`);
    const hashes = [result.sha, result.diff_refs?.head_sha].filter(Boolean);
    const matchesTask = github
      ? result.head?.sha === commit && result.head.ref === branch && result.base?.ref === target
      : result.source_branch === branch && result.target_branch === target && hashes.every(sha => sha === commit);
    const matchesId = number === undefined || route.endsWith(`/${number}`);
    if (url.origin === `https://${host}` && !url.username && !url.password && samePath && validRoute.test(route) && matchesTask && matchesId) {
      return { url: url.origin + url.pathname, verifySource: !github && !hashes.length };
    }
    return { reason: 'The API response did not confirm a review request for this task. Verify it in the remote project.' };
  } catch {
    return { reason: 'The review API did not return a confirmed result. Check the remote project before retrying manually.' };
  }
}

export function createdBranch(porcelain: string, refspec: string): boolean {
  return porcelain.split('\n').some(line => {
    const [flag, ref] = line.split('\t');
    return flag === '*' && ref === refspec;
  });
}
