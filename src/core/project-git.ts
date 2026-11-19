import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { AGENT_CONFIG_FILE } from './agent-config.js';
import { branchRef, deliveryRemote, git, gitValue } from './delivery/git.js';

export const gitProviderSchema = z.enum(['github', 'gongfeng']);
export type GitProvider = z.infer<typeof gitProviderSchema>;

export interface ProjectGitConfig {
  provider: GitProvider;
  remote: string;
  target: string;
}

const keys = { provider: 'KEAVEAI_GIT_PROVIDER', remote: 'KEAVEAI_GIT_REMOTE', target: 'KEAVEAI_GIT_TARGET' } as const;
const assignment = /^\s*(?:export\s+)?(KEAVEAI_GIT_(?:PROVIDER|REMOTE|TARGET))\s*=\s*(.*?)\s*$/;

async function readConfig(dir: string): Promise<string> {
  try {
    return await fs.readFile(path.join(dir, AGENT_CONFIG_FILE), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  }
}

export function projectGitInput(provider?: string, remote?: string, target?: string): ProjectGitConfig {
  const parsed = gitProviderSchema.safeParse(provider);
  if (!parsed.success || !remote || !target) {
    throw new Error('Set Git provider (github or gongfeng), remote name and target branch together.');
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(remote) || target.startsWith('-') ||
      [...target].some(c => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127 || ['"', "'", '#', '$', '`', '='].includes(c))) {
    throw new Error('Use a Git remote name and a literal target branch in agent.config.');
  }
  return { provider: parsed.data, remote, target };
}

export async function readProjectGit(dir: string): Promise<ProjectGitConfig | undefined> {
  const values = new Map<string, string>();
  for (const line of (await readConfig(dir)).split(/\r?\n/)) {
    const record = line.match(assignment);
    if (!record) continue;
    const [, key, raw] = record;
    if (values.has(key)) throw new Error(`Duplicate ${key} in agent.config. Reconfigure Git with keaveai init.`);
    values.set(key, raw.replace(/^(?:"([^"]*)"|'([^']*)')$/, (_, double, single) => double ?? single));
  }
  if (!values.size) return;
  return projectGitInput(values.get(keys.provider), values.get(keys.remote), values.get(keys.target));
}

export async function writeProjectGit(dir: string, config: ProjectGitConfig): Promise<void> {
  const file = path.join(dir, AGENT_CONFIG_FILE);
  let mode = 0o600;
  try {
    const current = await fs.lstat(file);
    if (!current.isFile()) throw new Error('agent.config must be a regular file to update Git settings.');
    mode = current.mode & 0o777;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const current = await readConfig(dir);
  const newline = current.includes('\r\n') ? '\r\n' : '\n';
  const assignments = Object.entries(keys).map(([field, key]) => `${key}=${config[field as keyof ProjectGitConfig]}`);
  // Replace only owned keys, retaining the formatting of everything else.
  const rest = current.split(/(?<=\n)/).filter(line => !assignment.test(line.replace(/\r?\n$/, ''))).join('');
  const separator = rest && !rest.endsWith('\n') ? newline : '';
  const updated = rest + separator + assignments.join(newline) + newline;
  if (updated === current) return;
  const temporary = path.join(dir, `.${AGENT_CONFIG_FILE}.${randomUUID()}.tmp`);
  await fs.writeFile(temporary, updated, { flag: 'wx', mode });
  try {
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

export function hostedProject(provider: GitProvider, endpoint: string): { host: string; repository: string } {
  const scp = endpoint.match(/^([^\s:/]+):([^:/].*)$/);
  let url: URL | undefined;
  try { url = new URL(scp ? `ssh://${scp[1]}/${scp[2]}` : endpoint); } catch { /* not a hosted URL */ }
  const host = provider === 'github' ? 'github.com' : 'git.code.tencent.com';
  const parts = url?.pathname.replace(/^\//, '').replace(/\/$/, '').replace(/\.git$/, '').split('/') ?? [];
  if (!url || !['https:', 'ssh:'].includes(url.protocol) || url.password || url.search || url.hash ||
      (url.hostname !== host && !(provider === 'github' && url.protocol === 'ssh:' && url.hostname === 'ssh.github.com')) ||
      (url.protocol === 'https:' && (url.port || url.username)) || (provider === 'github' ? parts.length !== 2 : parts.length < 2) ||
      parts.some(segment => !/^[\w.-]+$/.test(segment) || segment === '.' || segment === '..')) {
    throw new Error(`Selected Git remote must be a ${host} repository (HTTPS or SSH).`);
  }
  return { host, repository: parts.join('/') };
}

export async function validateProjectGit(dir: string, config: ProjectGitConfig) {
  const remote = await deliveryRemote(dir, config.remote);
  const project = hostedProject(config.provider, remote.url);
  await git(dir, ['check-ref-format', branchRef(config.target)], { failure: 'Invalid Git target branch.' });
  return { ...remote, ...project };
}

export async function gitSetupDefaults(dir: string) {
  const root = await gitValue(dir, 'rev-parse', '--show-toplevel').catch(() => undefined);
  if (!root || await fs.realpath(dir) !== await fs.realpath(root)) return;
  const remotes = (await gitValue(dir, 'remote')).split('\n').filter(Boolean);
  if (!remotes.length) return;
  return { remotes };
}
