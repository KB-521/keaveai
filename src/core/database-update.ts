import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import {
  DEFAULT_KEAVEAI_DATABASE_BRANCH,
  DEFAULT_KEAVEAI_DATABASE_REPO,
  refreshBundledDatabaseAssets,
} from './database-assets.js';

export interface DatabaseUpdateOptions {
  repo?: string;
  branch?: string;
}

export class DatabaseUpdateCommand {
  async execute(targetPath?: string, options: DatabaseUpdateOptions = {}): Promise<void> {
    const repoUrl = options.repo ?? DEFAULT_KEAVEAI_DATABASE_REPO;
    const branch = options.branch ?? DEFAULT_KEAVEAI_DATABASE_BRANCH;
    const targetDir = targetPath ? path.resolve(targetPath) : undefined;
    const spinner = ora(`Refreshing bundled KeaveAI database from ${repoUrl}...`).start();

    try {
      const updatedDir = await refreshBundledDatabaseAssets({
        targetDir,
        repoUrl,
        branch,
      });
      spinner.succeed('Bundled KeaveAI database refreshed');
      console.log(chalk.green(`✓ Updated: ${updatedDir}`));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      spinner.fail(`Bundled KeaveAI database refresh failed: ${message}`);
      throw new Error(`Failed to refresh bundled KeaveAI database from ${repoUrl}: ${message}`);
    }
  }
}
