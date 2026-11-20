import { Command } from 'commander';
import { DeliveryTaskCommand, type StartDeliveryOptions } from '../core/delivery/task.js';

async function output(run: () => Promise<object>): Promise<void> {
  try {
    const result = await run();
    console.log(JSON.stringify(result, null, 2));
    if ('status' in result && result.status === 'requested-unconfirmed') process.exitCode = 2;
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

export function registerDeliveryCommand(program: Command): void {
  const delivery = program.command('delivery').description('Prepare, review and publish an isolated code task');

  delivery.command('start <task-id>')
    .description('Create a task branch and worktree from the linked target or current local branch')
    .requiredOption('--allow <paths...>', 'Literal repository-relative paths or directories the task may change')
    .option('--context <files...>', 'Task and rule files that must match the committed baseline')
    .option('--worktree-root <path>', 'Existing parent directory outside the shared clone')
    .option('--branch-prefix <prefix>', 'Repository branch prefix (defaults to keaveai/task)')
    .action((id: string, options: StartDeliveryOptions) => output(() => new DeliveryTaskCommand().start(id, options)));

  delivery.command('snapshot <task-id>')
    .description('Identify the exact staged tree and base to send to an independent reviewer')
    .option('--refresh-base', 'Adopt the latest target base after restaging the task on it; invalidates the old review')
    .action((id: string, options: { refreshBase?: boolean }) => output(() => new DeliveryTaskCommand().snapshot(id, options)));

  delivery.command('commit <task-id>')
    .description('Commit an approved snapshot with repository hooks enabled')
    .requiredOption('--review <file>', 'JSON record from the implementation and independent review agents')
    .requiredOption('--message <text>', 'Commit message')
    .action((id: string, options: { review: string; message: string }) => output(() => new DeliveryTaskCommand().commit(id, options)));

  delivery.command('merge <task-id>')
    .description('Fast-forward the original local branch to the approved task commit')
    .option('--confirm', 'Authorize this local branch update')
    .action((id: string, options: { confirm?: boolean }) => output(() => new DeliveryTaskCommand().merge(id, options)));

  delivery.command('publish <task-id>')
    .description('Push the approved branch and open a GitHub PR or Tencent Gongfeng MR; never merges')
    .requiredOption('--title <text>', 'Single-line PR/MR title')
    .option('--confirm', 'Authorize this push and PR/MR creation')
    .action((id: string, options: { title: string; confirm?: boolean }) =>
      output(() => new DeliveryTaskCommand().publish(id, options)));
}
