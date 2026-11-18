import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import {
  DEFAULT_WEAVEAI_DATABASE_BRANCH,
  DEFAULT_WEAVEAI_DATABASE_REPO,
  refreshBundledDatabaseAssets,
} from './database-assets.js';

export interface DatabaseUpdateOptions {
  repo?: string;
  branch?: string;
}

export class DatabaseUpdateCommand {
  async execute(targetPath?: string, options: DatabaseUpdateOptions = {}): Promise<void> {
    const repoUrl = options.repo ?? DEFAULT_WEAVEAI_DATABASE_REPO;
    const branch = options.branch ?? DEFAULT_WEAVEAI_DATABASE_BRANCH;
    const targetDir = targetPath ? path.resolve(targetPath) : undefined;
    const spinner = ora(`Refreshing bundled WeaveAI database from ${repoUrl}...`).start();

    try {
      const updatedDir = await refreshBundledDatabaseAssets({
        targetDir,
        repoUrl,
        branch,
      });
      spinner.succeed('Bundled WeaveAI database refreshed');
      console.log(chalk.green(`✓ Updated: ${updatedDir}`));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      spinner.fail(`Bundled WeaveAI database refresh failed: ${message}`);
      throw new Error(`Failed to refresh bundled WeaveAI database from ${repoUrl}: ${message}`);
    }
  }
}
