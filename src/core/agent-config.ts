import { promises as fs } from 'node:fs';
import path from 'node:path';
import { git, gitValue } from './delivery/git.js';

export const AGENT_CONFIG_FILE = 'agent.config';

async function readOptional(file: string): Promise<string> {
  try { return await fs.readFile(file, 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  }
}

export async function ensureAgentConfigFile(projectPath: string): Promise<void> {
  await fs.mkdir(projectPath, { recursive: true });
  try {
    await fs.writeFile(path.join(projectPath, AGENT_CONFIG_FILE), '', { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
}

export async function ensureLocalAgentConfig(projectPath: string): Promise<void> {
  const root = await gitValue(projectPath, 'rev-parse', '--show-toplevel').catch(() => undefined);
  if (root && await fs.realpath(root) === await fs.realpath(projectPath)) {
    if (await gitValue(projectPath, 'ls-files', '--', AGENT_CONFIG_FILE)) {
      console.warn('agent.config is tracked by Git. Remove any tokens from the file and use environment variables instead.');
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
}
