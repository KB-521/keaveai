import { execFile } from 'child_process';
import * as fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { FileSystemUtils } from '../utils/file-system.js';

export const KEAVEAI_DATABASE_DIR = 'keaveai-database';
export const KEAVEAI_DATABASE_CONTENT_DIR = 'ai-workflow';
export const KEAVEAI_DATABASE_CODEX_SKILLS_DIR = path.join('.codex', 'skills');
export const KEAVEAI_DATABASE_GLOBAL_SKILLS_DIR = 'global';
export const DEFAULT_KEAVEAI_DATABASE_REPO = 'http://gitlab.metac-inc.com/front/weaveai-database.git';
export const DEFAULT_KEAVEAI_DATABASE_BRANCH = 'main';

/**
 * Default-pack skills retired because they bind the previous company's
 * Java/Metac stack, CI, or a single-tool gate. Init/update/refresh must
 * not copy or leave these paths in a project or bundled database.
 */
export const RETIRED_DEFAULT_SKILL_PATHS = [
  'ai-workflow/skills/server',
  'ai-workflow/skills/common/codex-parallel-execute',
  'ai-workflow/skills/common/init-rules/rules',
  '.codex/skills/ci-test-codegen',
] as const;

export const RETIRED_DEFAULT_SKILL_INDEX_MARKERS = [
  'server/pay-starter-impl',
  'server/backend-design',
  'server/data-model-design',
  'server/persistence-impl',
  'server/skeleton-codegen',
  'server/entry-impl',
  'server/req-impl',
  'server/test-codegen',
  'server/code-review',
  'server/init-business',
  'server/yapi-mcp-sync',
  'common/codex-parallel-execute',
  'ci-test-codegen',
] as const;

const RETIRED_GLOBAL_SKILL_DIRS = new Set(['ci-test-codegen']);

export async function removeRetiredDefaultSkills(rootDir: string): Promise<void> {
  for (const rel of RETIRED_DEFAULT_SKILL_PATHS) {
    await fs.promises.rm(path.join(rootDir, rel), { recursive: true, force: true });
  }

  await scrubRetiredSkillIndex(path.join(rootDir, 'ai-workflow', 'skills', 'INDEX.md'));
}

async function scrubRetiredSkillIndex(indexPath: string): Promise<void> {
  if (!(await FileSystemUtils.fileExists(indexPath))) {
    return;
  }

  const original = await fs.promises.readFile(indexPath, 'utf-8');
  const next = original
    .split('\n')
    .filter((line) => {
      if (!line.startsWith('|')) {
        return true;
      }
      return !RETIRED_DEFAULT_SKILL_INDEX_MARKERS.some((marker) => line.includes(marker));
    })
    .join('\n');

  if (next !== original) {
    await fs.promises.writeFile(indexPath, next);
  }
}


export type SkillTargetTool = {
  value: string;
  name: string;
  skillsDir: string;
};

export interface RefreshBundledDatabaseOptions {
  targetDir?: string;
  repoUrl?: string;
  branch?: string;
}

export function getPackageRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), '..', '..');
}

export function getBundledDatabaseDir(): string {
  return process.env.KEAVEAI_DATABASE_SOURCE_DIR
    ? path.resolve(process.env.KEAVEAI_DATABASE_SOURCE_DIR)
    : path.join(getPackageRoot(), KEAVEAI_DATABASE_DIR);
}

export async function ensureBundledDatabaseExists(sourceDir = getBundledDatabaseDir()): Promise<void> {
  const workflowDir = path.join(sourceDir, KEAVEAI_DATABASE_CONTENT_DIR);
  if (!(await FileSystemUtils.directoryExists(workflowDir))) {
    throw new Error(`Bundled KeaveAI database is missing '${KEAVEAI_DATABASE_CONTENT_DIR}/' at ${sourceDir}`);
  }
}

export async function copyBundledDatabaseAssets(
  projectPath: string,
  tools: SkillTargetTool[],
  sourceDir = getBundledDatabaseDir()
): Promise<void> {
  await ensureBundledDatabaseExists(sourceDir);

  const sourceKeaveAIDir = path.join(sourceDir, KEAVEAI_DATABASE_CONTENT_DIR);
  const targetKeaveAIDir = path.join(projectPath, KEAVEAI_DATABASE_CONTENT_DIR);
  await fs.promises.cp(sourceKeaveAIDir, targetKeaveAIDir, { recursive: true, force: true });
  await removeRetiredDefaultSkills(projectPath);

  await syncGlobalSkills(sourceDir, projectPath, tools);
}

export async function syncGlobalSkills(
  sourceDir: string,
  projectPath: string,
  tools: SkillTargetTool[]
): Promise<void> {
  if (tools.length === 0) {
    return;
  }

  const globalSkillsDir = await resolveSkillsSourceDir(sourceDir);
  if (!(await FileSystemUtils.directoryExists(globalSkillsDir))) {
    return;
  }

  const entries = await fs.promises.readdir(globalSkillsDir, { withFileTypes: true });
  const globalSkillDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const tool of tools) {
    const targetSkillsRoot = path.join(projectPath, tool.skillsDir, 'skills');
    await fs.promises.mkdir(targetSkillsRoot, { recursive: true });

    for (const dirName of globalSkillDirs) {
      const sourceSkillDir = path.join(globalSkillsDir, dirName);
      if (RETIRED_GLOBAL_SKILL_DIRS.has(dirName)) {
        continue;
      }

      const sourceSkillFile = path.join(sourceSkillDir, 'SKILL.md');
      if (!(await FileSystemUtils.fileExists(sourceSkillFile))) {
        continue;
      }

      const targetSkillDir = path.join(targetSkillsRoot, dirName);
      await fs.promises.cp(sourceSkillDir, targetSkillDir, { recursive: true, force: true });
    }
  }
}

export async function resolveSkillsSourceDir(sourceDir: string): Promise<string> {
  const codexSkillsDir = path.join(sourceDir, KEAVEAI_DATABASE_CODEX_SKILLS_DIR);
  if (await FileSystemUtils.directoryExists(codexSkillsDir)) {
    return codexSkillsDir;
  }

  return path.join(sourceDir, KEAVEAI_DATABASE_GLOBAL_SKILLS_DIR);
}

export async function copyDatabaseRootContents(
  sourceDir: string,
  projectPath: string,
  excludes: Set<string>
): Promise<void> {
  await ensureBundledDatabaseExists(sourceDir);

  const entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (excludes.has(entry.name)) {
      continue;
    }

    await fs.promises.cp(
      path.join(sourceDir, entry.name),
      path.join(projectPath, entry.name),
      { recursive: true, force: true }
    );
  }

  await removeRetiredDefaultSkills(projectPath);
}

export async function copyLegacyGlobalSkillsToCodex(sourceDir: string, projectPath: string): Promise<void> {
  const globalDir = path.join(sourceDir, KEAVEAI_DATABASE_GLOBAL_SKILLS_DIR);
  if (!(await FileSystemUtils.directoryExists(globalDir))) {
    return;
  }

  const targetSkillsDir = path.join(projectPath, KEAVEAI_DATABASE_CODEX_SKILLS_DIR);
  await fs.promises.mkdir(targetSkillsDir, { recursive: true });

  const entries = await fs.promises.readdir(globalDir, { withFileTypes: true });
  for (const entry of entries) {
    if (RETIRED_GLOBAL_SKILL_DIRS.has(entry.name)) {
      continue;
    }

    await fs.promises.cp(
      path.join(globalDir, entry.name),
      path.join(targetSkillsDir, entry.name),
      { recursive: true, force: true }
    );
  }

  await removeRetiredDefaultSkills(projectPath);
}

export async function refreshBundledDatabaseAssets(
  options: RefreshBundledDatabaseOptions = {}
): Promise<string> {
  const repoUrl = options.repoUrl ?? process.env.KEAVEAI_DATABASE_REPO_URL ?? DEFAULT_KEAVEAI_DATABASE_REPO;
  const branch = options.branch ?? process.env.KEAVEAI_DATABASE_REPO_BRANCH ?? DEFAULT_KEAVEAI_DATABASE_BRANCH;
  const targetDir = path.resolve(options.targetDir ?? getBundledDatabaseDir());
  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'keaveai-database-refresh-'));
  const cloneDir = path.join(tempRoot, KEAVEAI_DATABASE_DIR);

  try {
    await runGitCommand(['clone', '--depth', '1', '--branch', branch, repoUrl, cloneDir]);

    const sourceKeaveAIDir = path.join(cloneDir, KEAVEAI_DATABASE_CONTENT_DIR);
    if (!(await FileSystemUtils.directoryExists(sourceKeaveAIDir))) {
      throw new Error(`Remote repository is missing '${KEAVEAI_DATABASE_CONTENT_DIR}/'`);
    }

    await fs.promises.rm(targetDir, { recursive: true, force: true });
    await fs.promises.mkdir(targetDir, { recursive: true });

    const entries = await fs.promises.readdir(cloneDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git') {
        continue;
      }

      await fs.promises.cp(
        path.join(cloneDir, entry.name),
        path.join(targetDir, entry.name),
        { recursive: true, force: true }
      );
    }

    await removeRetiredDefaultSkills(targetDir);

    return targetDir;
  } finally {
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  }
}

async function runGitCommand(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile('git', args, (error, _stdout, stderr) => {
      if (!error) {
        resolve();
        return;
      }

      const stderrMessage = typeof stderr === 'string'
        ? stderr.trim()
        : String(stderr ?? '').trim();
      reject(new Error(stderrMessage || error.message));
    });
  });
}
