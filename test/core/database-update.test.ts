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
  git(repoDir, ['config', 'user.name', 'KeaveAI Test']);
  git(repoDir, ['config', 'user.email', 'keaveai-test@example.com']);

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
    vi.unstubAllEnvs();
    await Promise.all(
      createdDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
    );
  });

  it('refreshes bundled database contents into the requested path', async () => {
    const testDir = path.join(os.tmpdir(), `keaveai-database-update-test-${randomUUID()}`);
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

  it.each([
    ['ai-workflow/skills/common/codex-parallel-execute/SKILL.md', '# Old skill\n'],
    ['ai-workflow/skills/common/example/SKILL.md', 'Use com.metac.example as the default package.\n'],
  ])('rejects legacy source asset %s before replacing the target', async (relative, content) => {
    const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'keaveai-db-refresh-'));
    createdDirs.push(testDir);
    const repoDir = await createDatabaseRepo(testDir);
    await writeFile(path.join(repoDir, relative), content);
    git(repoDir, ['add', '.']);
    git(repoDir, ['commit', '-m', 'add incompatible asset']);
    const targetDir = path.join(testDir, 'target-database');
    const existing = path.join(targetDir, 'ai-workflow', 'README.md');
    await writeFile(existing, '# Existing database\n');

    await expect(new DatabaseUpdateCommand().execute(targetDir, { repo: repoDir }))
      .rejects.toThrow('Incompatible KeaveAI database asset');
    await expect(fs.readFile(existing, 'utf8')).resolves.toBe('# Existing database\n');
  });

  it('requires an explicit source and honors the environment override', async () => {
    vi.stubEnv('KEAVEAI_DATABASE_REPO_URL', '');
    await expect(new DatabaseUpdateCommand().execute()).rejects.toThrow('--repo');

    const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'keaveai-db-env-'));
    createdDirs.push(testDir);
    const repoDir = await createDatabaseRepo(testDir);
    const targetDir = path.join(testDir, 'target-database');
    vi.stubEnv('KEAVEAI_DATABASE_REPO_URL', repoDir);
    await new DatabaseUpdateCommand().execute(targetDir);
    expect(await pathExists(path.join(targetDir, 'ai-workflow', 'README.md'))).toBe(true);
  });
});
