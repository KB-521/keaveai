import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { UpdateCommand } from '../../src/core/update.js';

const ENV_KEYS = [
  'VITEST',
  'KEAVEAI_INIT_REPO_URL',
  'KEAVEAI_INIT_REPO_BRANCH',
  'KEAVEAI_INIT_SKIP_REMOTE_SYNC',
  'KEAVEAI_DATABASE_SOURCE_DIR',
  'KEAVEAI_UPDATE_REPO_URL',
  'KEAVEAI_UPDATE_REPO_BRANCH',
  'KEAVEAI_UPDATE_SKIP_REMOTE_SYNC',
];

async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

function git(cwd: string, args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'pipe' });
}

async function createKeaveAIDatabaseRepo(parentDir: string): Promise<string> {
  const repoDir = path.join(parentDir, 'keaveai-database');
  await fs.mkdir(repoDir, { recursive: true });

  git(repoDir, ['init']);
  git(repoDir, ['checkout', '-b', 'main']);
  git(repoDir, ['config', 'user.name', 'KeaveAI Test']);
  git(repoDir, ['config', 'user.email', 'keaveai-test@example.com']);

  await writeFile(path.join(repoDir, 'ai-workflow', 'README.md'), '# Remote AI Workflow\n');
  await writeFile(path.join(repoDir, '.codex', 'skills', 'init', 'SKILL.md'), '# Remote Init Skill\n');
  await writeFile(path.join(repoDir, '.codex', 'skills', 'req-dev', 'SKILL.md'), '# Remote Req Dev Skill\n');
  await writeFile(path.join(repoDir, '.codex', 'skills', 'draft.txt'), 'not a skill directory\n');

  git(repoDir, ['add', '.']);
  git(repoDir, ['commit', '-m', 'seed keaveai database']);

  return repoDir;
}

describe('UpdateCommand', () => {
  let testDir: string;
  let savedEnv: Map<string, string | undefined>;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `keaveai-update-test-${randomUUID()}`);
    await fs.mkdir(testDir, { recursive: true });

    savedEnv = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
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

  it('requires an initialized workflow directory and does not accept legacy openspec alone', async () => {
    await fs.mkdir(path.join(testDir, 'openspec'), { recursive: true });

    await expect(new UpdateCommand().execute(testDir)).rejects.toThrow(
      "No KeaveAI workflow directory found. Run 'keaveai init' first."
    );
  });

  it('can validate an ai-workflow project without remote writes when sync is skipped', async () => {
    await fs.mkdir(path.join(testDir, 'ai-workflow'), { recursive: true });
    process.env.KEAVEAI_UPDATE_SKIP_REMOTE_SYNC = '1';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(new UpdateCommand().execute(testDir)).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Skipped KeaveAI database sync.')
    );
    await expect(fs.readFile(path.join(testDir, 'agent.config'), 'utf-8'))
      .resolves.toBe('');
  });

  it('syncs ai-workflow content and detected tool skills from the database repository', async () => {
    const databaseRepo = await createKeaveAIDatabaseRepo(testDir);
    const projectDir = path.join(testDir, 'project');
    await fs.mkdir(path.join(projectDir, 'ai-workflow'), { recursive: true });
    await fs.mkdir(path.join(projectDir, '.codex'), { recursive: true });
    await writeFile(path.join(projectDir, 'ai-workflow', 'README.md'), '# Local AI Workflow\n');

    process.env.KEAVEAI_DATABASE_SOURCE_DIR = databaseRepo;

    await new UpdateCommand().execute(projectDir);

    await expect(fs.readFile(path.join(projectDir, 'ai-workflow', 'README.md'), 'utf-8'))
      .resolves.toBe('# Remote AI Workflow\n');
    await expect(fs.readFile(path.join(projectDir, '.codex', 'skills', 'init', 'SKILL.md'), 'utf-8'))
      .resolves.toBe('# Remote Init Skill\n');
    await expect(fs.readFile(path.join(projectDir, '.codex', 'skills', 'req-dev', 'SKILL.md'), 'utf-8'))
      .resolves.toBe('# Remote Req Dev Skill\n');
    await expect(fs.readFile(path.join(projectDir, 'agent.config'), 'utf-8'))
      .resolves.toBe('');
  });
});
