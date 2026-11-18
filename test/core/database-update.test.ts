import { describe, it, expect, afterEach, vi } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { DatabaseUpdateCommand } from '../../src/core/database-update.js';

async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

function git(cwd: string, args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'pipe' });
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function createDatabaseRepo(parentDir: string): Promise<string> {
  const repoDir = path.join(parentDir, 'source-database');
  await fs.mkdir(repoDir, { recursive: true });

  git(repoDir, ['init']);
  git(repoDir, ['checkout', '-b', 'main']);
  git(repoDir, ['config', 'user.name', 'WeaveAI Test']);
  git(repoDir, ['config', 'user.email', 'weaveai-test@example.com']);

  await writeFile(path.join(repoDir, 'ai-workflow', 'README.md'), '# Fresh Database\n');
  await writeFile(path.join(repoDir, '.codex', 'skills', 'init', 'SKILL.md'), '# Init Skill\n');

  git(repoDir, ['add', '.']);
  git(repoDir, ['commit', '-m', 'seed database']);

  return repoDir;
}

describe('DatabaseUpdateCommand', () => {
  const createdDirs: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(
      createdDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
    );
  });

  it('refreshes bundled database contents into the requested path', async () => {
    const testDir = path.join(os.tmpdir(), `weaveai-database-update-test-${randomUUID()}`);
    createdDirs.push(testDir);
    await fs.mkdir(testDir, { recursive: true });
    const repoDir = await createDatabaseRepo(testDir);
    const targetDir = path.join(testDir, 'target-database');
    await writeFile(path.join(targetDir, 'stale.md'), '# Stale\n');
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await new DatabaseUpdateCommand().execute(targetDir, {
      repo: repoDir,
      branch: 'main',
    });

    await expect(fs.readFile(path.join(targetDir, 'ai-workflow', 'README.md'), 'utf-8'))
      .resolves.toBe('# Fresh Database\n');
    await expect(fs.readFile(path.join(targetDir, '.codex', 'skills', 'init', 'SKILL.md'), 'utf-8'))
      .resolves.toBe('# Init Skill\n');
    expect(await pathExists(path.join(targetDir, 'stale.md'))).toBe(false);
    expect(await pathExists(path.join(targetDir, '.git'))).toBe(false);
  });
});
