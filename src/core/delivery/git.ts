import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

type GitOptions = { codes?: number[]; failure?: string; network?: boolean; env?: NodeJS.ProcessEnv };

export function git(cwd: string, args: string[], options: GitOptions = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env, ...options.env, GIT_NO_REPLACE_OBJECTS: '1' };
  if (options.network) env.GIT_TERMINAL_PROMPT = '0';
  // A caller's index, worktree or object-directory override must not redirect delivery operations.
  for (const name of ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_NAMESPACE']) {
    delete env[name];
  }
  return new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
    const timeout = options.network ? 5 * 60_000 : 15 * 60_000;
    const command = options.network ? ['-c', 'http.followRedirects=false', ...args] : args;
    execFile('git', command, { cwd, env, timeout, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      const code = error?.code ?? (error ? -1 : 0);
      if (typeof code === 'number' && (options.codes ?? [0]).includes(code)) {
        resolve({ stdout, stderr, code });
      } else {
        // Remote failures get a specific message without URLs or credentials from Git's output.
        reject(new Error(options.failure ?? (stderr.trim() || stdout.trim() || `git ${args[0]} failed.`)));
      }
    });
  });
}

function stripRecordEnd(output: string): string {
  return output.replace(process.platform === 'win32' ? /\r?\n$/ : /\n$/, '');
}

export async function gitValue(cwd: string, ...args: string[]): Promise<string> {
  return stripRecordEnd((await git(cwd, args)).stdout);
}

export function splitNul(value: string): string[] {
  return value.split('\0').filter(Boolean);
}

export function branchRef(branch: string): string {
  return `refs/heads/${branch}`;
}

export async function deliveryRemote(cwd: string, remote: string, overrides: string[] = []): Promise<{ url: string; identity: string }> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(remote)) {
    throw new Error('Choose an explicitly configured Git remote name, not a URL.');
  }
  const fetch = await git(cwd, [...overrides, 'remote', 'get-url', '--all', remote], { failure: `Unknown Git remote '${remote}'.` });
  const push = await git(cwd, [...overrides, 'remote', 'get-url', '--push', '--all', remote], { failure: `No push destination for '${remote}'.` });
  const url = stripRecordEnd(fetch.stdout);
  if (!url || url.includes('\n') || url !== stripRecordEnd(push.stdout)) {
    throw new Error('Delivery requires one Git remote with the same fetch and push URL.');
  }
  // Relative filesystem remotes resolve differently when invoked from a linked worktree.
  if (!(path.isAbsolute(url) || /^(?:https?|ssh|file):\/\//i.test(url) || /^[^\s:/]+:[^:/]/.test(url))) {
    throw new Error('Delivery requires a standard Git URL or an absolute filesystem remote.');
  }
  return { url, identity: createHash('sha256').update(url).digest('hex') };
}

export async function pinRemote(cwd: string, name: string, url: string): Promise<string[]> {
  // An empty Git URL value clears earlier values. Keep the remote name passed to normal hooks.
  const overrides = ['-c', `remote.${name}.url=`, '-c', `remote.${name}.url=${url}`,
    '-c', `remote.${name}.pushurl=`, '-c', `remote.${name}.pushurl=${url}`];
  if ((await deliveryRemote(cwd, name, overrides)).url !== url) {
    throw new Error('Git URL rewriting would change the verified delivery destination.');
  }
  return overrides;
}

export async function fetchBase(cwd: string, remote: string, target: string, overrides: string[]): Promise<string> {
  const targetRef = branchRef(target);
  await git(cwd, ['check-ref-format', targetRef], { failure: `Invalid target branch '${target}'.` });
  const trackingRef = `refs/remotes/${remote}/${target}`;
  await git(cwd, [...overrides, 'fetch', '--no-tags', '--no-recurse-submodules', '--no-prune', '--no-write-fetch-head',
    '--refmap=', remote, `+${targetRef}:${trackingRef}`], {
    network: true, failure: `Could not fetch '${remote}/${target}'. Check the remote, branch and credentials.`,
  });
  return gitValue(cwd, 'rev-parse', '--verify', `${trackingRef}^{commit}`);
}

export async function remoteHeads(cwd: string, remote: string, branches: string[], overrides: string[]): Promise<Map<string, string>> {
  const { stdout } = await git(cwd, [...overrides, 'ls-remote', '--refs', remote, ...branches.map(branchRef)], {
    network: true, failure: `Could not read branches from '${remote}'. Check access before publishing.`,
  });
  return new Map(stdout.trim().split('\n').filter(Boolean).map(line => {
    const [oid, ref] = line.split('\t');
    return [ref, oid];
  }));
}

export async function exists(file: string): Promise<boolean> {
  try {
    await fs.lstat(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

export function isWithin(root: string, file: string): boolean {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export async function worktreePaths(cwd: string): Promise<string[]> {
  return splitNul((await git(cwd, ['worktree', 'list', '--porcelain', '-z'])).stdout)
    .filter(field => field.startsWith('worktree ')).map(field => field.slice('worktree '.length));
}

export async function status(cwd: string): Promise<string[]> {
  return splitNul((await git(cwd, ['status', '--porcelain=v1', '-z', '--no-renames',
    '--untracked-files=all', '--ignore-submodules=none'])).stdout);
}
