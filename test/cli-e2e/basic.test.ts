import { afterAll, describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { runCLI, cliProjectRoot } from '../helpers/run-cli.js';
import { AI_TOOLS, type AIToolOption } from '../../src/core/config.js';

type SkillToolOption = AIToolOption & { skillsDir: string };

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

const tempRoots: string[] = [];

async function prepareFixture(fixtureName: string): Promise<string> {
  const base = await fs.mkdtemp(path.join(tmpdir(), 'openspec-cli-e2e-'));
  tempRoots.push(base);
  const projectDir = path.join(base, 'project');
  await fs.mkdir(projectDir, { recursive: true });
  const fixtureDir = path.join(cliProjectRoot, 'test', 'fixtures', fixtureName);
  await fs.cp(fixtureDir, projectDir, { recursive: true });
  return projectDir;
}

afterAll(async () => {
  await Promise.all(tempRoots.map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('openspec CLI e2e basics', () => {
  it('shows help output', async () => {
    const result = await runCLI(['--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage: keaveai');
    expect(result.stdout).toContain('init');
    expect(result.stdout).toContain('update');
    expect(result.stdout).toContain('break-change');
    expect(result.stdout).toContain('database-update');
    expect(result.stdout).toContain('issue');
    expect(result.stdout).toContain('help');
    expect(result.stdout).not.toContain('config');
    expect(result.stdout).not.toContain('schema');
    expect(result.stdout).not.toContain('completion');
    expect(result.stdout).not.toContain('validate');
    expect(result.stderr).toBe('');
  });

  it('shows dynamic tool ids in init help', async () => {
    const result = await runCLI(['init', '--help']);
    expect(result.exitCode).toBe(0);

    const expectedTools = AI_TOOLS.filter((tool) => tool.skillsDir)
      .map((tool) => tool.value)
      .join(', ');
    const normalizedOutput = result.stdout.replace(/\s+/g, ' ').trim();
    expect(normalizedOutput).toContain(
      `Use "all", "none", or a comma-separated list of: ${expectedTools}`
    );
  });

  it('reports the package version', async () => {
    const pkgRaw = await fs.readFile(path.join(cliProjectRoot, 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgRaw);
    const result = await runCLI(['--version']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(pkg.version);
  });

  it('validates the tmp-init fixture with --all --json', async () => {
    const projectDir = await prepareFixture('tmp-init');
    const result = await runCLI(['validate', '--all', '--json'], { cwd: projectDir });
    expect(result.exitCode).toBe(0);
    const output = result.stdout.trim();
    expect(output).not.toBe('');
    const json = JSON.parse(output);
    expect(json.summary?.totals?.failed).toBe(0);
    expect(json.items.some((item: any) => item.id === 'c1' && item.type === 'change')).toBe(true);
  });

  it('returns an error for unknown items in the fixture', async () => {
    const projectDir = await prepareFixture('tmp-init');
    const result = await runCLI(['validate', 'does-not-exist'], { cwd: projectDir });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown item 'does-not-exist'");
  });

  describe('init command non-interactive options', () => {
    it('initializes with --tools all option', async () => {
      const projectDir = await prepareFixture('tmp-init');
      const emptyProjectDir = path.join(projectDir, '..', 'empty-project');
      await fs.mkdir(emptyProjectDir, { recursive: true });

      const codexHome = path.join(emptyProjectDir, '.codex');
      const result = await runCLI(['init', '--tools', 'all'], {
        cwd: emptyProjectDir,
        env: { CODEX_HOME: codexHome },
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('KeaveAI Setup Complete');
      expect(result.stdout).toContain('Skills installed to: .codex/skills');
    });

    it('initializes with --tools list option', async () => {
      const projectDir = await prepareFixture('tmp-init');
      const emptyProjectDir = path.join(projectDir, '..', 'empty-project');
      await fs.mkdir(emptyProjectDir, { recursive: true });

      const selectedTool = AI_TOOLS.find(
        (tool): tool is SkillToolOption => Boolean(tool.skillsDir)
      );
      if (!selectedTool) {
        throw new Error('Expected at least one skill-capable tool in AI_TOOLS');
      }

      const result = await runCLI(['init', '--tools', selectedTool.value], { cwd: emptyProjectDir });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('KeaveAI Setup Complete');
      expect(result.stdout).toContain(path.join(selectedTool.skillsDir, 'skills'));

      const unselectedTools = AI_TOOLS.filter(
        (tool): tool is SkillToolOption =>
          Boolean(tool.skillsDir && tool.value !== selectedTool.value)
      );

      for (const tool of unselectedTools) {
        expect(result.stdout).not.toContain(path.join(tool.skillsDir, 'skills'));
      }
    });

    it('initializes with --tools none option', async () => {
      const projectDir = await prepareFixture('tmp-init');
      const emptyProjectDir = path.join(projectDir, '..', 'empty-project');
      await fs.mkdir(emptyProjectDir, { recursive: true });

      const result = await runCLI(['init', '--tools', 'none'], { cwd: emptyProjectDir });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('KeaveAI Setup Complete');

      // With --tools none, no tool skills should be created
      const skillTools = AI_TOOLS.filter(
        (tool): tool is SkillToolOption => Boolean(tool.skillsDir)
      );
      for (const tool of skillTools) {
        const skillsDir = path.join(emptyProjectDir, tool.skillsDir, 'skills');
        expect(await fileExists(skillsDir)).toBe(false);
      }
    });

    it('returns error for invalid tool names', async () => {
      const projectDir = await prepareFixture('tmp-init');
      const emptyProjectDir = path.join(projectDir, '..', 'empty-project');
      await fs.mkdir(emptyProjectDir, { recursive: true });

      const result = await runCLI(['init', '--tools', 'invalid-tool'], { cwd: emptyProjectDir });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid tool(s): invalid-tool');
      expect(result.stderr).toContain('Available values:');
    });

    it('returns error when combining reserved keywords with explicit ids', async () => {
      const projectDir = await prepareFixture('tmp-init');
      const emptyProjectDir = path.join(projectDir, '..', 'empty-project');
      await fs.mkdir(emptyProjectDir, { recursive: true });

      const result = await runCLI(['init', '--tools', 'all,claude'], { cwd: emptyProjectDir });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Cannot combine reserved values "all" or "none" with specific tool IDs');
    });
  });
});
