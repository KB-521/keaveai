import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  IssueCommand,
  buildDefaultTitle,
  buildGitLabMergeRequestPushArgs,
  getDefaultIssuePaths,
  getTargetIssuePaths,
  listFilesForPaths,
  mapIssueTargetPath,
  parseIncludePaths,
  parsePorcelainStatus,
  type CommandRunner,
} from '../../src/commands/issue.js';

function createTempProject(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'keaveai-issue-test-'));
  fs.mkdirSync(path.join(tempDir, 'ai-workflow'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'ai-workflow', 'README.md'), '# AI Workflow\n');
  fs.mkdirSync(path.join(tempDir, 'ai-workflow', 'sdd'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'ai-workflow', 'sdd', 'design.md'), '# SDD\n');
  fs.mkdirSync(path.join(tempDir, 'ai-workflow', 'wiki'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'ai-workflow', 'wiki', 'notes.md'), '# Wiki\n');
  fs.mkdirSync(path.join(tempDir, 'ai-workflow', 'memory'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'ai-workflow', 'memory', 'LOCAL.md'), '# Local Memory\n');
  fs.mkdirSync(path.join(tempDir, '.codex', 'skills', 'openspec-propose'), { recursive: true });
  fs.writeFileSync(
    path.join(tempDir, '.codex', 'skills', 'openspec-propose', 'SKILL.md'),
    '# Skill\n'
  );
  return tempDir;
}

function createRunner(resolver: (
  args: string[],
  cwd: string
) => { stdout?: string; stderr?: string; exitCode?: number }): {
  runner: CommandRunner;
  calls: string[][];
} {
  const calls: string[][] = [];
  return {
    calls,
    runner: async (_command, args, options) => {
      calls.push(args);
      const result = resolver(args, options.cwd);
      return {
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
        exitCode: result.exitCode ?? 0,
      };
    },
  };
}

describe('IssueCommand', () => {
  let tempDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = createTempProject();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    consoleLogSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('uses KeaveAI initialized paths by default', () => {
    const defaults = getDefaultIssuePaths();

    expect(defaults).toContain('ai-workflow');
    expect(defaults).toContain(path.join('.codex', 'skills'));
    expect(defaults).not.toContain('openspec');
  });

  it('keeps initialized paths aligned with the remote repository layout', () => {
    expect(mapIssueTargetPath(path.join('.codex', 'skills'))).toBe(path.join('.codex', 'skills'));
    expect(mapIssueTargetPath(path.join('.codex', 'skills', 'openspec-propose', 'SKILL.md'))).toBe(
      path.join('.codex', 'skills', 'openspec-propose', 'SKILL.md')
    );
    expect(getTargetIssuePaths(['ai-workflow', path.join('.codex', 'skills')])).toEqual([
      'ai-workflow',
      path.join('.codex', 'skills'),
    ]);
  });

  it('lists remote file paths and excludes ai-workflow private content', async () => {
    const files = await listFilesForPaths(tempDir, ['ai-workflow', path.join('.codex', 'skills')]);

    expect(files).toContain('ai-workflow/README.md');
    expect(files).toContain(path.join('.codex', 'skills', 'openspec-propose', 'SKILL.md'));
    expect(files).not.toContain(path.join('ai-workflow', 'sdd', 'design.md'));
    expect(files).not.toContain(path.join('ai-workflow', 'wiki', 'notes.md'));
    expect(files).not.toContain(path.join('ai-workflow', 'memory', 'LOCAL.md'));
  });

  it('parses comma-separated include paths safely', () => {
    expect(parseIncludePaths('ai-workflow, .codex/skills, ai-workflow')).toEqual([
      'ai-workflow',
      path.join('.codex', 'skills'),
    ]);

    expect(() => parseIncludePaths('/tmp/ai-workflow')).toThrow(/relative/);
    expect(() => parseIncludePaths('../ai-workflow')).toThrow(/cannot contain/);
  });

  it('parses porcelain status output into changed file paths', () => {
    const files = parsePorcelainStatus([
      '?? ai-workflow/README.md',
      ' M .codex/skills/openspec-propose/SKILL.md',
      'R  old/path.md -> ai-workflow/new-path.md',
    ].join('\n'));

    expect(files).toEqual([
      'ai-workflow/README.md',
      '.codex/skills/openspec-propose/SKILL.md',
      'ai-workflow/new-path.md',
    ]);
  });

  it('builds GitLab merge request push options', () => {
    const args = buildGitLabMergeRequestPushArgs({
      remote: 'origin',
      branch: 'keaveai/init-test',
      target: 'main',
      title: 'Initialize KeaveAI',
      description: 'Install KeaveAI',
    });

    expect(args).toEqual([
      'push',
      '-o',
      'merge_request.create',
      '-o',
      'merge_request.target=main',
      '-o',
      'merge_request.title=Initialize KeaveAI',
      '-o',
      'merge_request.description=Install KeaveAI',
      'origin',
      'keaveai/init-test',
    ]);
  });

  it('prints a dry-run plan without changing git state', async () => {
    const { runner, calls } = createRunner((args) => {
      return {};
    });

    const command = new IssueCommand(runner, tempDir);
    await command.execute({ dryRun: true, branch: 'keaveai/init-test' });

    expect(calls.some((args) => args[0] === 'checkout')).toBe(false);
    expect(calls.some((args) => args[0] === 'push')).toBe(false);
    expect(consoleLogSpy).toHaveBeenCalledWith('KeaveAI issue dry run:');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '  Remote: http://gitlab.metac-inc.com/front/weaveai-database.git'
    );
    expect(consoleLogSpy).toHaveBeenCalledWith('  Target: main');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `  Title: sync ai workflow and codex skills from ${path.basename(tempDir)}`
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `  Commit: sync ai workflow and codex skills from ${path.basename(tempDir)}`
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `  Remote paths: ai-workflow, ${path.join('.codex', 'skills')}`
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('ai-workflow/README.md'));
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(path.join('.codex', 'skills', 'openspec-propose', 'SKILL.md'))
    );
    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('ai-workflow/sdd/design.md'));
  });

  it('creates a branch, commits initialized files, and pushes an MR directly', async () => {
    const { runner, calls } = createRunner((args) => {
      if (args[0] === 'ls-remote') {
        return { stdout: '' };
      }
      if (args[0] === 'clone') {
        return {};
      }
      if (args[0] === 'checkout') {
        return {};
      }
      if (args[0] === 'status') {
        return {
          stdout: [
            '?? ai-workflow/README.md',
            `?? ${path.join('.codex', 'skills', 'openspec-propose', 'SKILL.md')}`,
          ].join('\n'),
        };
      }
      if (args[0] === 'diff' && args.includes('--quiet')) {
        return { exitCode: 1 };
      }
      if (args[0] === 'push') {
        return {
          stderr: 'remote: View merge request for keaveai/init-test: https://gitlab.example.com/acme/app/-/merge_requests/1\n',
        };
      }
      return {};
    });

    const command = new IssueCommand(runner, tempDir);
    await command.execute({
      branch: 'keaveai/init-test',
      title: 'Install KeaveAI',
      message: 'chore: install KeaveAI',
      description: 'Install initialized content',
    });

    expect(calls).toContainEqual(['checkout', '-b', 'keaveai/init-test']);
    expect(calls.some((args) => args[0] === 'clone' && args.includes('http://gitlab.metac-inc.com/front/weaveai-database.git'))).toBe(true);
    expect(calls.some((args) => args[0] === 'add' && args.includes('ai-workflow'))).toBe(true);
    expect(calls.some((args) => args[0] === 'add' && args.includes(path.join('.codex', 'skills')))).toBe(true);
    expect(calls.some((args) => args[0] === 'add' && args.includes('global'))).toBe(false);
    expect(calls).toContainEqual(['commit', '-m', 'chore: install KeaveAI']);

    const pushCall = calls.find((args) => args[0] === 'push');
    expect(pushCall).toBeDefined();
    expect(pushCall).toContain('merge_request.create');
    expect(pushCall).toContain('merge_request.title=Install KeaveAI');
    expect(pushCall).toContain('http://gitlab.metac-inc.com/front/weaveai-database.git');
    expect(consoleLogSpy).not.toHaveBeenCalledWith('Files:');
    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('.codex/skills/openspec-propose/SKILL.md'));
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Merge request: https://gitlab.example.com/acme/app/-/merge_requests/1'
    );
  });

  it('copies only remote-ready initialized content into the temporary clone', async () => {
    const observedCopy: {
      codexSkill?: boolean;
      copiedSdd?: boolean;
      copiedWiki?: boolean;
      copiedMemory?: boolean;
      existingSdd?: boolean;
      existingWiki?: boolean;
      existingMemory?: boolean;
    } = {};

    const { runner } = createRunner((args, cwd) => {
      if (args[0] === 'clone') {
        const repoDir = args.at(-1);
        if (!repoDir) {
          return {};
        }
        fs.mkdirSync(path.join(repoDir, 'ai-workflow', 'sdd'), { recursive: true });
        fs.writeFileSync(path.join(repoDir, 'ai-workflow', 'sdd', 'existing.md'), '# Existing SDD\n');
        fs.mkdirSync(path.join(repoDir, 'ai-workflow', 'wiki'), { recursive: true });
        fs.writeFileSync(path.join(repoDir, 'ai-workflow', 'wiki', 'existing.md'), '# Existing Wiki\n');
        fs.mkdirSync(path.join(repoDir, 'ai-workflow', 'memory'), { recursive: true });
        fs.writeFileSync(path.join(repoDir, 'ai-workflow', 'memory', 'existing.md'), '# Existing Memory\n');
        return {};
      }
      if (args[0] === 'ls-remote' || args[0] === 'checkout') {
        return {};
      }
      if (args[0] === 'status') {
        observedCopy.codexSkill = fs.existsSync(
          path.join(cwd, '.codex', 'skills', 'openspec-propose', 'SKILL.md')
        );
        observedCopy.copiedSdd = fs.existsSync(path.join(cwd, 'ai-workflow', 'sdd', 'design.md'));
        observedCopy.copiedWiki = fs.existsSync(path.join(cwd, 'ai-workflow', 'wiki', 'notes.md'));
        observedCopy.copiedMemory = fs.existsSync(path.join(cwd, 'ai-workflow', 'memory', 'LOCAL.md'));
        observedCopy.existingSdd = fs.existsSync(path.join(cwd, 'ai-workflow', 'sdd', 'existing.md'));
        observedCopy.existingWiki = fs.existsSync(path.join(cwd, 'ai-workflow', 'wiki', 'existing.md'));
        observedCopy.existingMemory = fs.existsSync(path.join(cwd, 'ai-workflow', 'memory', 'existing.md'));
        return { stdout: '?? ai-workflow/README.md\n' };
      }
      if (args[0] === 'diff' && args.includes('--quiet')) {
        return { exitCode: 1 };
      }
      return {};
    });

    const command = new IssueCommand(runner, tempDir);
    await command.execute({
      branch: 'keaveai/init-test',
      title: 'Install KeaveAI',
    });

    expect(observedCopy).toEqual({
      codexSkill: true,
      copiedSdd: false,
      copiedWiki: false,
      copiedMemory: false,
      existingSdd: true,
      existingWiki: true,
      existingMemory: true,
    });
  });

  it('uses a semantic default MR title and commit message', async () => {
    const { runner, calls } = createRunner((args) => {
      if (args[0] === 'ls-remote' || args[0] === 'clone' || args[0] === 'checkout') {
        return {};
      }
      if (args[0] === 'status') {
        return { stdout: '?? ai-workflow/README.md\n' };
      }
      if (args[0] === 'diff' && args.includes('--quiet')) {
        return { exitCode: 1 };
      }
      return {};
    });

    const command = new IssueCommand(runner, tempDir);
    await command.execute({ branch: 'keaveai/init-test' });

    const expectedTitle = buildDefaultTitle(tempDir);
    expect(calls).toContainEqual(['commit', '-m', expectedTitle]);
    const pushCall = calls.find((args) => args[0] === 'push');
    expect(pushCall).toContain(`merge_request.title=${expectedTitle}`);
  });
});
