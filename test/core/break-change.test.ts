import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { BreakChangeCommand } from '../../src/core/break-change.js';

const ENV_KEYS = [
  'KEAVEAI_BREAK_CHANGE_REPO_URL',
  'KEAVEAI_BREAK_CHANGE_REPO_BRANCH',
  'KEAVEAI_UPDATE_REPO_URL',
  'KEAVEAI_UPDATE_REPO_BRANCH',
  'KEAVEAI_INIT_REPO_URL',
  'KEAVEAI_INIT_REPO_BRANCH',
  'KEAVEAI_DATABASE_SOURCE_DIR',
];

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

async function createBreakChangeRepo(parentDir: string): Promise<string> {
  const repoDir = path.join(parentDir, 'keaveai-database');
  await fs.mkdir(repoDir, { recursive: true });

  git(repoDir, ['init']);
  git(repoDir, ['checkout', '-b', 'main']);
  git(repoDir, ['config', 'user.name', 'KeaveAI Test']);
  git(repoDir, ['config', 'user.email', 'keaveai-test@example.com']);

  await writeFile(path.join(repoDir, '.codex', 'config.md'), '# Remote Codex Config\n');
  await writeFile(path.join(repoDir, '.codex', 'skills', 'init', 'SKILL.md'), '# Remote Init\n');
  await writeFile(path.join(repoDir, '.codex', 'skills', 'req-dev', 'SKILL.md'), '# Remote Req Dev\n');
  await writeFile(path.join(repoDir, '.cursor', 'rules.md'), '# Remote Cursor\n');
  await writeFile(path.join(repoDir, '.agents', 'config.md'), '# Remote Agents\n');
  await writeFile(path.join(repoDir, '.gitignore'), 'node_modules\n');
  await writeFile(path.join(repoDir, 'ai-workflow', 'README.md'), '# Remote Workflow\n');
  await writeFile(path.join(repoDir, 'ai-workflow', 'sdd', 'remote.md'), '# Remote SDD\n');
  await writeFile(path.join(repoDir, 'REMOTE.md'), '# Remote Root\n');

  git(repoDir, ['add', '.']);
  git(repoDir, ['commit', '-m', 'seed break-change layout']);

  return repoDir;
}

async function createLegacyBreakChangeRepo(parentDir: string): Promise<string> {
  const repoDir = path.join(parentDir, 'legacy-keaveai-database');
  await fs.mkdir(repoDir, { recursive: true });

  git(repoDir, ['init']);
  git(repoDir, ['checkout', '-b', 'main']);
  git(repoDir, ['config', 'user.name', 'KeaveAI Test']);
  git(repoDir, ['config', 'user.email', 'keaveai-test@example.com']);

  await writeFile(path.join(repoDir, 'global', 'init', 'SKILL.md'), '# Legacy Init\n');
  await writeFile(path.join(repoDir, 'ai-workflow', 'README.md'), '# Remote Workflow\n');
  await writeFile(path.join(repoDir, 'REMOTE.md'), '# Remote Root\n');

  git(repoDir, ['add', '.']);
  git(repoDir, ['commit', '-m', 'seed legacy break-change layout']);

  return repoDir;
}

describe('BreakChangeCommand', () => {
  let testDir: string;
  let savedEnv: Map<string, string | undefined>;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `keaveai-break-change-test-${randomUUID()}`);
    await fs.mkdir(testDir, { recursive: true });

    savedEnv = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }

    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    for (const key of ENV_KEYS) {
      const value = savedEnv.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    vi.restoreAllMocks();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('copies remote root content, replaces managed dirs, and preserves sdd under ai-workflow', async () => {
    const databaseRepo = await createBreakChangeRepo(testDir);
    const projectDir = path.join(testDir, 'project');

    await writeFile(path.join(projectDir, 'keaveai', 'sdd', 'design.md'), '# Local SDD\n');
    await writeFile(path.join(projectDir, 'keaveai', 'wiki', 'old.md'), '# Old Wiki\n');
    await writeFile(path.join(projectDir, '.codex', 'old.md'), '# Old Codex\n');
    await writeFile(path.join(projectDir, '.cursor', 'old.md'), '# Old Cursor\n');
    await writeFile(path.join(projectDir, '.agents', 'old.md'), '# Old Agents\n');
    await writeFile(path.join(projectDir, '.claude', 'old.md'), '# Old Claude\n');
    await writeFile(path.join(projectDir, 'AGENTS.md'), '# Old Agents File\n');
    await writeFile(path.join(projectDir, 'global', 'stale', 'SKILL.md'), '# Stale Global\n');
    await writeFile(path.join(projectDir, 'sdd', 'stale.md'), '# Stale Root SDD\n');
    await writeFile(path.join(projectDir, 'src', 'app.ts'), 'export const keep = true;\n');

    process.env.KEAVEAI_DATABASE_SOURCE_DIR = databaseRepo;

    await new BreakChangeCommand().execute(projectDir);

    await expect(fs.readFile(path.join(projectDir, 'ai-workflow', 'sdd', 'design.md'), 'utf-8'))
      .resolves.toBe('# Local SDD\n');
    expect(await pathExists(path.join(projectDir, 'ai-workflow', 'sdd', 'remote.md'))).toBe(false);
    expect(await pathExists(path.join(projectDir, 'ai-workflow', 'sdd', 'stale.md'))).toBe(false);
    expect(await pathExists(path.join(projectDir, 'sdd'))).toBe(false);
    expect(await pathExists(path.join(projectDir, 'keaveai'))).toBe(false);

    expect(await pathExists(path.join(projectDir, '.codex', 'old.md'))).toBe(false);
    await expect(fs.readFile(path.join(projectDir, '.codex', 'config.md'), 'utf-8'))
      .resolves.toBe('# Remote Codex Config\n');
    await expect(fs.readFile(path.join(projectDir, '.codex', 'skills', 'init', 'SKILL.md'), 'utf-8'))
      .resolves.toBe('# Remote Init\n');
    await expect(fs.readFile(path.join(projectDir, '.codex', 'skills', 'req-dev', 'SKILL.md'), 'utf-8'))
      .resolves.toBe('# Remote Req Dev\n');
    expect(await pathExists(path.join(projectDir, 'global'))).toBe(false);
    expect(await pathExists(path.join(projectDir, '.codex', 'skills', 'stale'))).toBe(false);

    expect(await pathExists(path.join(projectDir, '.cursor', 'old.md'))).toBe(false);
    await expect(fs.readFile(path.join(projectDir, '.cursor', 'rules.md'), 'utf-8'))
      .resolves.toBe('# Remote Cursor\n');

    expect(await pathExists(path.join(projectDir, '.agents', 'old.md'))).toBe(false);
    await expect(fs.readFile(path.join(projectDir, '.agents', 'config.md'), 'utf-8'))
      .resolves.toBe('# Remote Agents\n');
    expect(await pathExists(path.join(projectDir, '.claude'))).toBe(false);
    expect(await pathExists(path.join(projectDir, 'AGENTS.md'))).toBe(false);

    await expect(fs.readFile(path.join(projectDir, 'ai-workflow', 'README.md'), 'utf-8'))
      .resolves.toBe('# Remote Workflow\n');
    await expect(fs.readFile(path.join(projectDir, 'REMOTE.md'), 'utf-8'))
      .resolves.toBe('# Remote Root\n');
    await expect(fs.readFile(path.join(projectDir, 'src', 'app.ts'), 'utf-8'))
      .resolves.toBe('export const keep = true;\n');
    await expect(fs.readFile(path.join(projectDir, '.gitignore'), 'utf-8'))
      .resolves.toBe('node_modules\nai-workflow/memory/LOCAL.md\n');
    await expect(fs.readFile(path.join(projectDir, 'agent.config'), 'utf-8'))
      .resolves.toBe('');
  });

  it('preserves existing ai-workflow sdd when repairing a partially migrated project', async () => {
    const databaseRepo = await createBreakChangeRepo(testDir);
    const projectDir = path.join(testDir, 'project');

    await writeFile(path.join(projectDir, 'keaveai', 'sdd', 'template.md'), '# Remote Template SDD\n');
    await writeFile(path.join(projectDir, 'ai-workflow', 'sdd', 'original.md'), '# Original SDD\n');
    await writeFile(path.join(projectDir, 'global', 'stale', 'SKILL.md'), '# Stale Global\n');

    process.env.KEAVEAI_DATABASE_SOURCE_DIR = databaseRepo;

    await new BreakChangeCommand().execute(projectDir);

    await expect(fs.readFile(path.join(projectDir, 'ai-workflow', 'sdd', 'original.md'), 'utf-8'))
      .resolves.toBe('# Original SDD\n');
    expect(await pathExists(path.join(projectDir, 'ai-workflow', 'sdd', 'template.md'))).toBe(false);
    expect(await pathExists(path.join(projectDir, 'keaveai'))).toBe(false);
    expect(await pathExists(path.join(projectDir, 'global'))).toBe(false);
    await expect(fs.readFile(path.join(projectDir, '.codex', 'skills', 'init', 'SKILL.md'), 'utf-8'))
      .resolves.toBe('# Remote Init\n');
  });

  it('maps legacy remote global skills into .codex/skills', async () => {
    const databaseRepo = await createLegacyBreakChangeRepo(testDir);
    const projectDir = path.join(testDir, 'project');

    await writeFile(path.join(projectDir, 'keaveai', 'sdd', 'design.md'), '# Local SDD\n');

    process.env.KEAVEAI_DATABASE_SOURCE_DIR = databaseRepo;

    await new BreakChangeCommand().execute(projectDir);

    await expect(fs.readFile(path.join(projectDir, '.codex', 'skills', 'init', 'SKILL.md'), 'utf-8'))
      .resolves.toBe('# Legacy Init\n');
    expect(await pathExists(path.join(projectDir, 'global'))).toBe(false);
  });

  it('does not duplicate the local memory gitignore entry', async () => {
    const databaseRepo = await createBreakChangeRepo(testDir);
    const projectDir = path.join(testDir, 'project');

    await writeFile(path.join(projectDir, 'ai-workflow', 'sdd', 'design.md'), '# Local SDD\n');
    await writeFile(path.join(projectDir, '.gitignore'), 'ai-workflow/memory/LOCAL.md\n');

    process.env.KEAVEAI_DATABASE_SOURCE_DIR = databaseRepo;

    await new BreakChangeCommand().execute(projectDir);
    await new BreakChangeCommand().execute(projectDir);

    const gitignore = await fs.readFile(path.join(projectDir, '.gitignore'), 'utf-8');
    const entries = gitignore
      .split(/\r?\n/)
      .filter((line) => line === 'ai-workflow/memory/LOCAL.md');
    expect(entries).toHaveLength(1);
  });

  it('requires existing keaveai/sdd content before migrating', async () => {
    const projectDir = path.join(testDir, 'project');
    await fs.mkdir(projectDir, { recursive: true });

    await expect(new BreakChangeCommand().execute(projectDir)).rejects.toThrow(
      "No keaveai/sdd or ai-workflow/sdd directory found. Run 'keaveai init' first."
    );
  });
});
