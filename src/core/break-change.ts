/**
 * Break-change Command
 *
 * Migrates an initialized project to the bundled database layout while
 * preserving existing SDD content under ai-workflow/sdd.
 */

import * as fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { FileSystemUtils } from '../utils/file-system.js';
import { ensureAgentConfigFile } from './agent-config.js';
import {
  KEAVEAI_DATABASE_GLOBAL_SKILLS_DIR,
  copyDatabaseRootContents,
  copyLegacyGlobalSkillsToCodex,
  getBundledDatabaseDir,
  validateDatabaseSource,
} from './database-assets.js';

const KEAVEAI_SDD_DIR = path.join('keaveai', 'sdd');
const KEAVEAI_ROOT_DIR = 'keaveai';
const ROOT_SDD_DIR = 'sdd';
const AI_WORKFLOW_SDD_DIR = path.join('ai-workflow', 'sdd');
const GITIGNORE_FILE = '.gitignore';
const LOCAL_MEMORY_GITIGNORE_ENTRY = 'ai-workflow/memory/LOCAL.md';
const MANAGED_ROOT_PATHS = [
  '.codex',
  '.cursor',
  '.agents',
  KEAVEAI_ROOT_DIR,
  '.claude',
  'AGENTS.md',
  KEAVEAI_DATABASE_GLOBAL_SKILLS_DIR,
];
const DATABASE_COPY_EXCLUDES = new Set(['.git', ROOT_SDD_DIR, KEAVEAI_DATABASE_GLOBAL_SKILLS_DIR, KEAVEAI_ROOT_DIR]);

export class BreakChangeCommand {
  async execute(projectPath: string): Promise<void> {
    const resolvedProjectPath = path.resolve(projectPath);

    if (!(await FileSystemUtils.directoryExists(resolvedProjectPath))) {
      throw new Error(`Path "${projectPath}" is not a directory`);
    }

    if (!(await FileSystemUtils.ensureWritePermissions(resolvedProjectPath))) {
      throw new Error(`Insufficient permissions to write to ${resolvedProjectPath}`);
    }

    const sourceSddDir = await this.resolveSddSource(resolvedProjectPath);
    const rootSddDir = path.join(resolvedProjectPath, ROOT_SDD_DIR);
    await this.applyBreakChange(resolvedProjectPath, sourceSddDir, rootSddDir);
  }

  private async resolveSddSource(projectPath: string): Promise<string> {
    const existingMigratedSddDir = path.join(projectPath, AI_WORKFLOW_SDD_DIR);
    if (await FileSystemUtils.directoryExists(existingMigratedSddDir)) {
      return existingMigratedSddDir;
    }

    const keaveaiSddDir = path.join(projectPath, KEAVEAI_SDD_DIR);
    if (await FileSystemUtils.directoryExists(keaveaiSddDir)) {
      return keaveaiSddDir;
    }

    throw new Error(
      `No ${KEAVEAI_SDD_DIR} or ${AI_WORKFLOW_SDD_DIR} directory found. Run 'keaveai init' first.`
    );
  }

  private async applyBreakChange(
    projectPath: string,
    sourceSddDir: string,
    rootSddDir: string
  ): Promise<void> {
    const databaseDir = getBundledDatabaseDir();
    const spinner = ora(`Applying break-change migration from bundled database...`).start();

    try {
      await validateDatabaseSource(databaseDir);

      await fs.promises.rm(rootSddDir, { recursive: true, force: true });
      await fs.promises.cp(sourceSddDir, rootSddDir, { recursive: true, force: true });
      await this.removeManagedRootPaths(projectPath);
      await copyDatabaseRootContents(databaseDir, projectPath, DATABASE_COPY_EXCLUDES);
      await copyLegacyGlobalSkillsToCodex(databaseDir, projectPath);
      await this.movePreservedSdd(projectPath, rootSddDir);
      await this.ensureLocalMemoryGitignore(projectPath);
      await ensureAgentConfigFile(projectPath);

      spinner.succeed('Break-change migration applied');
      console.log(chalk.green(`✓ Preserved SDD: ${AI_WORKFLOW_SDD_DIR}`));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      spinner.fail(`Break-change migration failed: ${message}`);
      throw new Error(`Failed to apply break-change migration from bundled database: ${message}`);
    }
  }

  private async removeManagedRootPaths(projectPath: string): Promise<void> {
    for (const relativePath of MANAGED_ROOT_PATHS) {
      await fs.promises.rm(path.join(projectPath, relativePath), { recursive: true, force: true });
    }
  }

  private async movePreservedSdd(projectPath: string, rootSddDir: string): Promise<void> {
    const targetSddDir = path.join(projectPath, AI_WORKFLOW_SDD_DIR);
    await fs.promises.mkdir(path.dirname(targetSddDir), { recursive: true });
    await fs.promises.rm(targetSddDir, { recursive: true, force: true });
    await fs.promises.rename(rootSddDir, targetSddDir);
  }

  private async ensureLocalMemoryGitignore(projectPath: string): Promise<void> {
    const gitignorePath = path.join(projectPath, GITIGNORE_FILE);
    let content = '';

    try {
      content = await fs.promises.readFile(gitignorePath, 'utf-8');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        throw error;
      }
    }

    const hasEntry = content
      .split(/\r?\n/)
      .some((line) => line.trim() === LOCAL_MEMORY_GITIGNORE_ENTRY);
    if (hasEntry) {
      return;
    }

    const prefix = content.length === 0 || content.endsWith('\n')
      ? content
      : `${content}\n`;
    await fs.promises.writeFile(
      gitignorePath,
      `${prefix}${LOCAL_MEMORY_GITIGNORE_ENTRY}\n`
    );
  }

}
