import { execFile } from 'child_process';
import * as fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { FileSystemUtils } from '../utils/file-system.js';
import {
  removeRetiredDefaultSkills,
  shouldReplaceSkillIndex,
  validateSkillPack,
  WORKFLOW_INDEX,
} from './retired-default-skills.js';

export const KEAVEAI_DATABASE_DIR = 'keaveai-database';
export const KEAVEAI_DATABASE_CONTENT_DIR = 'ai-workflow';
export const KEAVEAI_DATABASE_CODEX_SKILLS_DIR = path.join('.codex', 'skills');
export const KEAVEAI_DATABASE_GLOBAL_SKILLS_DIR = 'global';
export const DEFAULT_KEAVEAI_DATABASE_BRANCH = 'main';

export function requireDatabaseRepo(repo?: string): string {
  const configured = (repo ?? process.env.KEAVEAI_DATABASE_REPO_URL)?.trim();
  if (!configured) {
    throw new Error('Specify a database source with --repo or KEAVEAI_DATABASE_REPO_URL.');
  }
  return configured;
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

export async function validateDatabaseSource(source: string): Promise<void> {
  await ensureBundledDatabaseExists(source);
  await validateSkillPack(source);
}

async function skillIndexCopyFilter(source: string, target: string): Promise<(file: string) => boolean> {
  const replaceIndex = await shouldReplaceSkillIndex(source, target);
  const indexPath = path.resolve(source, WORKFLOW_INDEX);
  return (file) => replaceIndex || path.resolve(file) !== indexPath;
}

export async function copyBundledDatabaseAssets(
  projectPath: string,
  tools: SkillTargetTool[],
  sourceDir = getBundledDatabaseDir()
): Promise<void> {
  await validateDatabaseSource(sourceDir);

  const sourceKeaveAIDir = path.join(sourceDir, KEAVEAI_DATABASE_CONTENT_DIR);
  const targetKeaveAIDir = path.join(projectPath, KEAVEAI_DATABASE_CONTENT_DIR);
  const filter = await skillIndexCopyFilter(sourceDir, projectPath);
  await fs.promises.cp(sourceKeaveAIDir, targetKeaveAIDir, { recursive: true, force: true, filter });
  await syncGlobalSkills(sourceDir, projectPath, tools);
  await removeRetiredDefaultSkills(projectPath, tools.map((tool) => tool.skillsDir));
}

async function syncGlobalSkills(
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
  await validateDatabaseSource(sourceDir);
  const filter = await skillIndexCopyFilter(sourceDir, projectPath);
  const entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (excludes.has(entry.name)) {
      continue;
    }

    await fs.promises.cp(
      path.join(sourceDir, entry.name),
      path.join(projectPath, entry.name),
      { recursive: true, force: true, filter }
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
    await fs.promises.cp(
      path.join(globalDir, entry.name),
      path.join(targetSkillsDir, entry.name),
      { recursive: true, force: true }
    );
  }
}

export async function refreshBundledDatabaseAssets(
  options: RefreshBundledDatabaseOptions = {}
): Promise<string> {
  const repoUrl = requireDatabaseRepo(options.repoUrl);
  const branch = options.branch ?? process.env.KEAVEAI_DATABASE_REPO_BRANCH ?? DEFAULT_KEAVEAI_DATABASE_BRANCH;
  const targetDir = path.resolve(options.targetDir ?? getBundledDatabaseDir());
  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'keaveai-database-refresh-'));
  const cloneDir = path.join(tempRoot, KEAVEAI_DATABASE_DIR);

  try {
    await runGitCommand(['clone', '--depth', '1', '--branch', branch, repoUrl, cloneDir]);

    await validateDatabaseSource(cloneDir);

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
