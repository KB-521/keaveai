import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  RETIRED_DEFAULT_SKILL_INDEX_MARKERS,
  RETIRED_DEFAULT_SKILL_PATHS,
  copyBundledDatabaseAssets,
  getBundledDatabaseDir,
  removeRetiredDefaultSkills,
  syncGlobalSkills,
} from '../../src/core/database-assets.js';

const FORBIDDEN_CONTENT_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'dachui', pattern: /dachui/i },
  { name: 'sunwencong', pattern: /sunwencong/i },
  { name: 'xuyang', pattern: /xuyang/i },
  { name: 'com.metac', pattern: /com\.metac/ },
  { name: 'my-archetype', pattern: /my-archetype/ },
  { name: 'sqlmapplus', pattern: /sqlmapplus/i },
  { name: 'OpenDAO', pattern: /opendao/i },
];

const DELETED_SKILL_PATHS = [
  'ai-workflow/skills/server/pay-starter-impl',
  'ai-workflow/skills/server/backend-design',
  'ai-workflow/skills/server/data-model-design',
  'ai-workflow/skills/server/persistence-impl',
  'ai-workflow/skills/server/skeleton-codegen',
  'ai-workflow/skills/server/entry-impl',
  'ai-workflow/skills/server/req-impl',
  'ai-workflow/skills/server/test-codegen',
  'ai-workflow/skills/server/code-review',
  'ai-workflow/skills/server/init-business',
  'ai-workflow/skills/server/yapi-mcp-sync',
  '.codex/skills/ci-test-codegen',
  'ai-workflow/skills/common/codex-parallel-execute',
];

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

async function collectFiles(rootDir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }

  if (await pathExists(rootDir)) {
    await walk(rootDir);
  }
  return files;
}

describe('default skill pack cleanup', () => {
  const createdDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      createdDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
    );
  });

  it('does not keep retired skills in the bundled database', async () => {
    const bundledDir = getBundledDatabaseDir();

    for (const rel of DELETED_SKILL_PATHS) {
      expect(await pathExists(path.join(bundledDir, rel)), rel).toBe(false);
    }

    expect(await pathExists(path.join(bundledDir, 'ai-workflow', 'skills', 'server'))).toBe(false);
    expect(await pathExists(path.join(bundledDir, 'ai-workflow', 'skills', 'common', 'init-rules', 'rules'))).toBe(false);
    expect(await pathExists(path.join(bundledDir, 'ai-workflow', 'skills', 'common', 'parallel-execute', 'SKILL.md'))).toBe(true);
  });

  it('does not list or recommend retired skills in the default index', async () => {
    const indexPath = path.join(getBundledDatabaseDir(), 'ai-workflow', 'skills', 'INDEX.md');
    const index = await fs.readFile(indexPath, 'utf-8');

    for (const marker of RETIRED_DEFAULT_SKILL_INDEX_MARKERS) {
      expect(index, marker).not.toContain(marker);
    }

    expect(index).toContain('common/parallel-execute');
    expect(index).not.toContain('`server/');
  });

  it('does not leave previous-company names or Java stack bindings in remaining default skills', async () => {
    const bundledDir = getBundledDatabaseDir();
    const files = [
      ...(await collectFiles(path.join(bundledDir, 'ai-workflow'))),
      ...(await collectFiles(path.join(bundledDir, '.codex'))),
    ];

    const hits: string[] = [];
    for (const filePath of files) {
      const rel = path.relative(bundledDir, filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      for (const { name, pattern } of FORBIDDEN_CONTENT_PATTERNS) {
        if (pattern.test(content)) {
          hits.push(`${rel}: ${name}`);
        }
      }
    }

    expect(hits).toEqual([]);
  });

  it('strips retired skills and index rows during copyBundledDatabaseAssets', async () => {
    const testDir = path.join(os.tmpdir(), `keaveai-retired-skills-${randomUUID()}`);
    createdDirs.push(testDir);

    const sourceDir = path.join(testDir, 'source-database');
    const projectDir = path.join(testDir, 'project');

    await writeFile(
      path.join(sourceDir, 'ai-workflow', 'skills', 'common', 'code-commit', 'SKILL.md'),
      '---\nname: code-commit\nversion: 1.0.0\n---\nkeep\n'
    );
    await writeFile(
      path.join(sourceDir, 'ai-workflow', 'skills', 'server', 'pay-starter-impl', 'SKILL.md'),
      '---\nname: pay-starter-impl\n---\nretired\n'
    );
    await writeFile(
      path.join(sourceDir, 'ai-workflow', 'skills', 'common', 'codex-parallel-execute', 'SKILL.md'),
      '---\nname: codex-parallel-execute\n---\nretired\n'
    );
    await writeFile(
      path.join(sourceDir, 'ai-workflow', 'skills', 'INDEX.md'),
      [
        '# Skills 索引',
        '',
        '| 目录 | `name` | version | owners | 作用说明 | 典型使用时机 | 主要产出/关注点 |',
        '| --- | --- | --- | --- | --- | --- | --- |',
        '| `common/code-commit` | `code-commit` | 1.0.0 | - | keep | keep | keep |',
        '| `common/codex-parallel-execute` | `codex-parallel-execute` | 1.6.0 | - | retired | retired | retired |',
        '| `server/pay-starter-impl` | `pay-starter-impl` | 1.0.0 | - | retired | retired | retired |',
        '',
      ].join('\n')
    );
    await writeFile(
      path.join(sourceDir, '.codex', 'skills', 'init', 'SKILL.md'),
      '---\nname: init\n---\nkeep\n'
    );
    await writeFile(
      path.join(sourceDir, '.codex', 'skills', 'ci-test-codegen', 'SKILL.md'),
      '---\nname: ci-test-codegen\n---\nretired\n'
    );

    await copyBundledDatabaseAssets(
      projectDir,
      [{ value: 'cursor', name: 'Cursor', skillsDir: '.cursor' }],
      sourceDir
    );

    expect(await pathExists(path.join(projectDir, 'ai-workflow', 'skills', 'common', 'code-commit', 'SKILL.md'))).toBe(true);
    expect(await pathExists(path.join(projectDir, 'ai-workflow', 'skills', 'server'))).toBe(false);
    expect(await pathExists(path.join(projectDir, 'ai-workflow', 'skills', 'common', 'codex-parallel-execute'))).toBe(false);
    expect(await pathExists(path.join(projectDir, '.cursor', 'skills', 'init', 'SKILL.md'))).toBe(true);
    expect(await pathExists(path.join(projectDir, '.cursor', 'skills', 'ci-test-codegen'))).toBe(false);

    const copiedIndex = await fs.readFile(
      path.join(projectDir, 'ai-workflow', 'skills', 'INDEX.md'),
      'utf-8'
    );
    expect(copiedIndex).toContain('common/code-commit');
    expect(copiedIndex).not.toContain('pay-starter-impl');
    expect(copiedIndex).not.toContain('codex-parallel-execute');
  });

  it('skips retired global skills when syncing tool skill directories', async () => {
    const testDir = path.join(os.tmpdir(), `keaveai-retired-global-skills-${randomUUID()}`);
    createdDirs.push(testDir);

    const sourceDir = path.join(testDir, 'source-database');
    const projectDir = path.join(testDir, 'project');
    await writeFile(path.join(sourceDir, 'ai-workflow', 'README.md'), '# workflow\n');
    await writeFile(path.join(sourceDir, '.codex', 'skills', 'init', 'SKILL.md'), '# init\n');
    await writeFile(path.join(sourceDir, '.codex', 'skills', 'ci-test-codegen', 'SKILL.md'), '# retired\n');

    await syncGlobalSkills(
      sourceDir,
      projectDir,
      [{ value: 'cursor', name: 'Cursor', skillsDir: '.cursor' }]
    );

    expect(await pathExists(path.join(projectDir, '.cursor', 'skills', 'init', 'SKILL.md'))).toBe(true);
    expect(await pathExists(path.join(projectDir, '.cursor', 'skills', 'ci-test-codegen'))).toBe(false);
  });

  it('removeRetiredDefaultSkills deletes retired paths and scrubs index rows', async () => {
    const testDir = path.join(os.tmpdir(), `keaveai-remove-retired-${randomUUID()}`);
    createdDirs.push(testDir);

    await writeFile(path.join(testDir, 'ai-workflow', 'skills', 'server', 'req-impl', 'SKILL.md'), 'retired\n');
    await writeFile(
      path.join(testDir, 'ai-workflow', 'skills', 'INDEX.md'),
      '| `common/prd-review` | `prd-review` | 1.1.0 | - | keep | keep | keep |\n| `server/req-impl` | `req-impl` | 2.0.0 | - | retired | retired | retired |\n'
    );

    await removeRetiredDefaultSkills(testDir);

    expect(await pathExists(path.join(testDir, 'ai-workflow', 'skills', 'server'))).toBe(false);
    const index = await fs.readFile(path.join(testDir, 'ai-workflow', 'skills', 'INDEX.md'), 'utf-8');
    expect(index).toContain('common/prd-review');
    expect(index).not.toContain('server/req-impl');
    expect(RETIRED_DEFAULT_SKILL_PATHS.length).toBeGreaterThan(0);
  });
});
