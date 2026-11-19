import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { branchRef, exists, gitValue } from './git.js';
import { type DeliveryTask, parseTask, taskBranch } from './model.js';

export async function commonDir(cwd: string): Promise<string> {
  return fs.realpath(await gitValue(cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'));
}

export function stateDir(gitCommonDir: string, id: string): string {
  taskBranch(id);
  return path.join(gitCommonDir, 'keaveai', 'delivery', id);
}

export async function reserveTask(dir: string, id: string): Promise<void> {
  await fs.mkdir(path.dirname(dir), { recursive: true });
  try {
    await fs.mkdir(dir, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    throw new Error(`Delivery task '${id}' already exists. Reuse its registered worktree instead of starting it again.`);
  }
}

export async function saveTask(dir: string, task: DeliveryTask): Promise<void> {
  const temp = path.join(dir, `${randomUUID()}.tmp`);
  await fs.writeFile(temp, JSON.stringify(task, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  try {
    await fs.rename(temp, path.join(dir, 'task.json'));
  } finally {
    if (await exists(temp)) await fs.unlink(temp);
  }
}

export async function withTask<T>(cwd: string, id: string, action: (task: DeliveryTask, dir: string) => Promise<T>): Promise<T> {
  const common = await commonDir(cwd);
  const dir = stateDir(common, id);
  const record = path.join(dir, 'task.json');
  if (!await exists(record)) throw new Error(`No registered delivery task '${id}'.`);

  const lock = path.join(dir, 'lock');
  const handle = await fs.open(lock, 'wx', 0o600).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'EEXIST') throw new Error(`Delivery task '${id}' is locked by another command.`);
    throw error;
  });
  try {
    await handle.writeFile(`PID ${process.pid}\n`);
    const task = parseTask(await fs.readFile(record, 'utf8'));
    if (task.id !== id || task.branch !== taskBranch(id, task.branchPrefix)) {
      throw new Error('Delivery task identity does not match its registry.');
    }
    await assertWorktree(task, common);
    return await action(task, dir);
  } finally {
    await handle.close();
    await fs.unlink(lock);
  }
}

export async function assertWorktree(task: DeliveryTask, expectedCommonDir: string): Promise<void> {
  const root = await gitValue(task.worktree, 'rev-parse', '--show-toplevel');
  const branch = await gitValue(task.worktree, 'symbolic-ref', 'HEAD');
  if (await fs.realpath(root) !== task.worktree || await commonDir(task.worktree) !== expectedCommonDir ||
      branch !== branchRef(task.branch)) {
    throw new Error(`Worktree for task '${task.id}' no longer matches its registered repository and branch.`);
  }
}
