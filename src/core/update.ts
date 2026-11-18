/**
 * Update Command
 *
 * Refreshes KeaveAI database assets and globally shared skills for initialized projects.
 */

import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { FileSystemUtils } from '../utils/file-system.js';
import { getAvailableTools } from './available-tools.js';
import { ensureAgentConfigFile } from './agent-config.js';
import {
  KEAVEAI_DATABASE_CONTENT_DIR,
  copyBundledDatabaseAssets,
} from './database-assets.js';

const LEGACY_KEAVEAI_DATABASE_CONTENT_DIR = 'keaveai';

export class UpdateCommand {
  async execute(projectPath: string): Promise<void> {
    const resolvedProjectPath = path.resolve(projectPath);
    const workflowPath = path.join(resolvedProjectPath, KEAVEAI_DATABASE_CONTENT_DIR);
    const legacyKeaveAIPath = path.join(resolvedProjectPath, LEGACY_KEAVEAI_DATABASE_CONTENT_DIR);

    if (
      !await FileSystemUtils.directoryExists(workflowPath) &&
      !await FileSystemUtils.directoryExists(legacyKeaveAIPath)
    ) {
      throw new Error(`No KeaveAI workflow directory found. Run 'keaveai init' first.`);
    }

    const tools = getAvailableTools(resolvedProjectPath)
      .filter((tool): tool is typeof tool & { skillsDir: string } => Boolean(tool.skillsDir));

    await this.syncKeaveAIDatabase(resolvedProjectPath, tools);
    await ensureAgentConfigFile(resolvedProjectPath);
  }

  private async syncKeaveAIDatabase(
    projectPath: string,
    tools: Array<{ value: string; name: string; skillsDir: string }>
  ): Promise<void> {
    if (
      process.env.KEAVEAI_UPDATE_SKIP_DATABASE_SYNC === '1' ||
      process.env.KEAVEAI_INIT_SKIP_REMOTE_SYNC === '1' ||
      process.env.KEAVEAI_UPDATE_SKIP_REMOTE_SYNC === '1'
    ) {
      console.log(chalk.dim('Skipped KeaveAI database sync.'));
      return;
    }

    const spinner = ora('Updating KeaveAI database from bundled assets...').start();

    try {
      await copyBundledDatabaseAssets(projectPath, tools);
      spinner.succeed('KeaveAI database updated');

      if (tools.length > 0) {
        console.log(chalk.green(`✓ Updated: ${tools.map((tool) => tool.name).join(', ')}`));
      } else {
        console.log(chalk.dim('No tools selected; skipped skills update.'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      spinner.fail(`KeaveAI database update failed: ${message}`);
      throw new Error(`Failed to update KeaveAI database from bundled assets: ${message}`);
    }
  }
}
