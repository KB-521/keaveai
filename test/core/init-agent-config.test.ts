import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { execFileSync } from 'node:child_process';
import { InitCommand } from '../../src/core/init.js';
import { chooseProjectGit } from '../../src/core/init-project-git.js';
import { readProjectGit } from '../../src/core/project-git.js';
import { input, select } from '@inquirer/prompts';

vi.mock('@inquirer/prompts', async importOriginal => ({ ...await importOriginal<typeof import('@inquirer/prompts')>(),
  select: vi.fn(), input: vi.fn(),
}));

function git(cwd: string, ...args: string[]) {
  execFileSync('git', args, { cwd, stdio: 'pipe' });
}

describe('InitCommand agent.config', () => {
  const createdDirs: string[] = [];

  afterEach(async () => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    await Promise.all(
      createdDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
    );
  });

  it('creates agent.config with empty token entries and no example file', async () => {
    const projectDir = path.join(os.tmpdir(), `keaveai-init-agent-config-${randomUUID()}`);
    createdDirs.push(projectDir);
    await fs.mkdir(projectDir, { recursive: true });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await new InitCommand({ tools: 'none' }).execute(projectDir);

    await expect(fs.readFile(path.join(projectDir, 'agent.config'), 'utf-8'))
      .resolves.toBe('GITHUB_TOKEN=\nGONGFENG_TOKEN=\n');
    await expect(fs.stat(path.join(projectDir, 'agent.config.example'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not overwrite an existing agent.config file', async () => {
    const projectDir = path.join(os.tmpdir(), `keaveai-init-agent-config-${randomUUID()}`);
    createdDirs.push(projectDir);
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(path.join(projectDir, 'agent.config'), 'existing config\n');
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await new InitCommand({ tools: 'none' }).execute(projectDir);

    await expect(fs.readFile(path.join(projectDir, 'agent.config'), 'utf-8'))
      .resolves.toBe('existing config\nGITHUB_TOKEN=\nGONGFENG_TOKEN=\n');
  });

  async function gitProject() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'keaveai-project-git-'));
    createdDirs.push(dir);
    git(dir, 'init', '--quiet', '-b', 'feature');
    git(dir, 'remote', 'add', 'team', 'https://git.code.tencent.com/team/project.git');
    git(dir, 'remote', 'add', 'origin', 'git@github.com:team/project.git');
    git(dir, 'symbolic-ref', 'refs/remotes/team/HEAD', 'refs/remotes/team/trunk');
    return dir;
  }

  it('offers platform and matching remotes, using the cached remote default branch', async () => {
    const dir = await gitProject();
    vi.mocked(select).mockResolvedValueOnce('gongfeng').mockResolvedValueOnce('team');
    vi.mocked(input).mockResolvedValueOnce('trunk');
    await expect(chooseProjectGit(dir, {}, true)).resolves.toEqual({ provider: 'gongfeng', remote: 'team', target: 'trunk' });
    expect(select).toHaveBeenNthCalledWith(1, expect.objectContaining({ default: 'github' }));
    expect(select).toHaveBeenNthCalledWith(2, expect.objectContaining({ choices: [{ name: 'team', value: 'team' }] }));
    expect(input).toHaveBeenCalledWith(expect.objectContaining({ default: 'trunk' }));
  });

  it('replaces only Git keys, preserves CRLF, and leaves a custom example untouched', async () => {
    const dir = await gitProject();
    const file = path.join(dir, 'agent.config');
    const unrelated = '# existing settings\r\nYUQUE_TOKEN=dummy\r\n\r\n# keep this comment\r\n';
    await fs.writeFile(file, unrelated + 'export KEAVEAI_GIT_PROVIDER = "github"\r\nKEAVEAI_GIT_REMOTE=origin\r\nKEAVEAI_GIT_TARGET=main\r\n');
    await fs.writeFile(path.join(dir, 'agent.config.example'), '# Custom example\n');
    const command = new InitCommand({ tools: 'none', interactive: false, gitProvider: 'gongfeng', gitRemote: 'team', gitTarget: 'trunk' });
    await command.execute(dir);
    await command.execute(dir);
    await expect(fs.readFile(file, 'utf8')).resolves.toBe(unrelated +
      'GITHUB_TOKEN=\r\nGONGFENG_TOKEN=\r\nKEAVEAI_GIT_PROVIDER=gongfeng\r\nKEAVEAI_GIT_REMOTE=team\r\nKEAVEAI_GIT_TARGET=trunk\r\n');
    await expect(readProjectGit(dir)).resolves.toEqual({ provider: 'gongfeng', remote: 'team', target: 'trunk' });
    await expect(fs.readFile(path.join(dir, 'agent.config.example'), 'utf8')).resolves.toBe('# Custom example\n');
  });

  it('does not configure unsupported providers, incomplete settings, or nonmatching remotes', async () => {
    const dir = await gitProject();
    const options = { gitRemote: 'team', gitTarget: 'trunk' };
    await expect(chooseProjectGit(dir, { ...options, gitProvider: 'gitlab' }, false)).rejects.toThrow(/github or gongfeng/);
    await expect(chooseProjectGit(dir, { gitProvider: 'github' }, false)).rejects.toThrow(/together/);
    await expect(chooseProjectGit(dir, { ...options, gitProvider: 'github' }, false)).rejects.toThrow(/github\.com/);
    await expect(readProjectGit(dir)).resolves.toBeUndefined();
  });
});
