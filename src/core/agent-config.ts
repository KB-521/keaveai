import { promises as fs } from 'node:fs';
import path from 'node:path';
import { git, gitValue } from './delivery/git.js';

export const AGENT_CONFIG_FILE = 'agent.config';
export type TokenKey = 'GITHUB_TOKEN' | 'GONGFENG_TOKEN';
const tokenKeys: TokenKey[] = ['GITHUB_TOKEN', 'GONGFENG_TOKEN'];
const tokenAssignment = /^\s*(?:export\s+)?(GITHUB_TOKEN|GONGFENG_TOKEN)\s*=\s*(.*?)\s*$/;

async function readOptional(file: string): Promise<string> {
  try { return await fs.readFile(file, 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  }
}

function readTokenAssignments(content: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(tokenAssignment);
    if (!match) continue;
    const [, key, value] = match;
    if (values.has(key)) throw new Error(`Duplicate ${key} in agent.config.`);
    values.set(key, value.replace(/^(?:"([^"]*)"|'([^']*)')$/, (_, quoted, single) => quoted ?? single));
  }
  return values;
}

export async function configuredToken(projectPath: string, key: TokenKey): Promise<string | undefined> {
  const token = readTokenAssignments(await readOptional(path.join(projectPath, AGENT_CONFIG_FILE))).get(key);
  if (!token) return;
  if (await gitValue(projectPath, 'ls-files', '--', AGENT_CONFIG_FILE)) {
    throw new Error('Do not store tokens in a tracked agent.config. Remove the token from the file and use an environment variable instead.');
  }
  if ((await git(projectPath, ['check-ignore', '--quiet', '--', AGENT_CONFIG_FILE], { codes: [0, 1] })).code === 1) {
    throw new Error('Ignore agent.config before storing tokens in it. Run keaveai git or add /agent.config to your Git exclude file.');
  }
  return token;
}

export async function ensureAgentConfigFile(projectPath: string): Promise<void> {
  await fs.mkdir(projectPath, { recursive: true });
  try {
    await fs.writeFile(path.join(projectPath, AGENT_CONFIG_FILE), '', { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
}

export async function ensureTokenFields(projectPath: string): Promise<void> {
  const root = await gitValue(projectPath, 'rev-parse', '--show-toplevel').catch(() => undefined);
  if (root && await fs.realpath(root) === await fs.realpath(projectPath)) {
    if (await gitValue(projectPath, 'ls-files', '--', AGENT_CONFIG_FILE)) {
      console.warn('agent.config is tracked by Git. Leave token values empty and use environment variables instead.');
    } else if ((await git(projectPath, ['check-ignore', '--quiet', '--', AGENT_CONFIG_FILE], { codes: [0, 1] })).code === 1) {
      const exclude = await gitValue(projectPath, 'rev-parse', '--path-format=absolute', '--git-path', 'info/exclude');
      const previous = await readOptional(exclude);
      await fs.mkdir(path.dirname(exclude), { recursive: true });
      await fs.appendFile(exclude, `${previous && !previous.endsWith('\n') ? '\n' : ''}/agent.config\n`);
    }
  }
  await ensureAgentConfigFile(projectPath);
  const file = path.join(projectPath, AGENT_CONFIG_FILE);
  if (!(await fs.lstat(file)).isFile()) throw new Error('agent.config must be a regular file.');
  const content = await readOptional(file);
  const values = readTokenAssignments(content);
  const missing = tokenKeys.filter(key => !values.has(key));
  if (!missing.length) return;
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  await fs.appendFile(file, (content && !content.endsWith('\n') ? newline : '') + missing.map(key => `${key}=${newline}`).join(''));
}
