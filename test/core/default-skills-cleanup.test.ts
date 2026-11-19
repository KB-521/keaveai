import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { copyBundledDatabaseAssets, getBundledDatabaseDir, validateDatabaseSource } from '../../src/core/database-assets.js';
import { WORKFLOW_INDEX } from '../../src/core/retired-default-skills.js';

const fixture = vi.hoisted(() => ({
  oldRule: 'ai-workflow/skills/common/init-rules/rules/06-DAO与SQL.md',
  oldBackend: 'ai-workflow/skills/server/backend-design',
  ci: '.codex/skills/ci-test-codegen',
  skillText: '# Old bundled fixture\n',
  scriptText: '# Old supporting script\n',
  ruleText: '# Old bundled rule\n',
  indexText: '| `server/backend-design` | old default |\n',
}));

// Use synthetic old assets: CI does not need Git history or the removed content to run these tests.
vi.mock(import('../../src/core/retired-skill-fingerprints.js'), async (importOriginal) => {
  const original = await importOriginal();
  const { createHash } = await import('node:crypto');
  const hash = (text: string) => createHash('sha256').update(text).digest('hex');
  return {
    RETIRED_SKILL_FINGERPRINTS: {
      ...original.RETIRED_SKILL_FINGERPRINTS,
      [fixture.oldRule]: hash(fixture.ruleText),
      [fixture.oldBackend]: hash(`SKILL.md\0${hash(fixture.skillText)}\n`),
      [fixture.ci]: hash(`SKILL.md\0${hash(fixture.skillText)}\nscripts/\0\nscripts/check.py\0${hash(fixture.scriptText)}\n`),
    },
    PREVIOUS_SKILL_INDEX_HASHES: new Set([...original.PREVIOUS_SKILL_INDEX_HASHES, hash(fixture.indexText)]),
  };
});

const roots: string[] = [];
async function temporaryRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'keaveai-skill-test-'));
  roots.push(root);
  return root;
}
async function write(root: string, relative: string, content: string) {
  const file = path.join(root, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}
async function installCI(root: string, dir: string, script = fixture.scriptText) {
  await write(root, `${dir}/SKILL.md`, fixture.skillText);
  await write(root, `${dir}/scripts/check.py`, script);
}

const missing = (file: string) => expect(fs.lstat(file)).rejects.toMatchObject({ code: 'ENOENT' });

const newSkill = 'ai-workflow/skills/common/backend-tech-solution-design/SKILL.md';

describe('default skill pack retirement', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
  });

  it('ships a clean default pack with the backend design and parallel execution skills indexed', async () => {
    const source = getBundledDatabaseDir();
    await expect(validateDatabaseSource(source)).resolves.toBeUndefined();
    const index = await fs.readFile(path.join(source, WORKFLOW_INDEX), 'utf8');
    expect(index).toContain('common/backend-tech-solution-design');
    expect(index).toContain('common/parallel-execute');
    expect(index).not.toContain('codex-parallel-execute');
    await expect(fs.readFile(path.join(source, newSkill), 'utf8')).resolves.toContain('name: backend-tech-solution-design');
  });

  it('removes verified old assets without deleting local server skills and rules', async () => {
    const project = await temporaryRoot();
    const customSkill = 'ai-workflow/skills/server/project-local/SKILL.md';
    const customRule = 'ai-workflow/skills/common/init-rules/rules/team-local.md';
    await write(project, `${fixture.oldBackend}/SKILL.md`, fixture.skillText);
    await write(project, fixture.oldRule, fixture.ruleText);
    await write(project, customSkill, 'custom skill');
    await write(project, customRule, 'custom rule');
    await write(project, WORKFLOW_INDEX, fixture.indexText);

    await copyBundledDatabaseAssets(project, []);

    await missing(path.join(project, fixture.oldBackend));
    await missing(path.join(project, fixture.oldRule));
    await expect(fs.readFile(path.join(project, customSkill), 'utf8')).resolves.toBe('custom skill');
    await expect(fs.readFile(path.join(project, customRule), 'utf8')).resolves.toBe('custom rule');
    const index = await fs.readFile(path.join(project, WORKFLOW_INDEX), 'utf8');
    expect(index).toContain('common/backend-tech-solution-design');
    expect(index).not.toContain('server/backend-design');
  });

  it('cleans old CI copies even for unselected tools, but preserves and reports a modified copy', async () => {
    const project = await temporaryRoot();
    const retired = [fixture.ci, '.cursor/skills/ci-test-codegen', '.claude/skills/ci-test-codegen', 'global/ci-test-codegen'];
    const modified = '.agents/skills/ci-test-codegen';
    for (const relative of retired) await installCI(project, relative);
    await installCI(project, modified, 'local supporting script');
    await write(project, WORKFLOW_INDEX, 'custom index');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await copyBundledDatabaseAssets(project, [{ name: 'Codex', value: 'codex', skillsDir: '.codex' }]);

    for (const relative of retired) await missing(path.join(project, relative));
    await expect(fs.readFile(path.join(project, modified, 'SKILL.md'), 'utf8')).resolves.toBe(fixture.skillText);
    await expect(fs.readFile(path.join(project, modified, 'scripts/check.py'), 'utf8')).resolves.toBe('local supporting script');
    await expect(fs.readFile(path.join(project, WORKFLOW_INDEX), 'utf8')).resolves.toBe('custom index');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(modified));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(WORKFLOW_INDEX));
  });

  it('does not follow a symlink to an otherwise matching retired skill', async () => {
    const project = await temporaryRoot();
    const other = await temporaryRoot();
    const target = path.join(other, fixture.ci);
    const link = path.join(project, fixture.ci);
    await installCI(other, fixture.ci);
    await fs.mkdir(path.dirname(link), { recursive: true });
    await fs.symlink(target, link, 'junction');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await copyBundledDatabaseAssets(project, []);

    expect((await fs.lstat(link)).isSymbolicLink()).toBe(true);
    await expect(fs.readFile(path.join(target, 'SKILL.md'), 'utf8')).resolves.toBe(fixture.skillText);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(fixture.ci));
  });

  it('rejects an outdated override source before touching the project', async () => {
    const project = await temporaryRoot();
    const source = await temporaryRoot();
    await write(source, `${fixture.oldBackend}/SKILL.md`, fixture.skillText);
    await write(project, fixture.oldRule, fixture.ruleText);

    await expect(copyBundledDatabaseAssets(project, [], source)).rejects.toThrow(fixture.oldBackend);

    await expect(fs.readFile(path.join(project, fixture.oldRule), 'utf8')).resolves.toBe(fixture.ruleText);
  });
});
