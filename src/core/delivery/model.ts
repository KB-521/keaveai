import { z } from 'zod';
import { gitProviderSchema } from '../project-git.js';

const objectId = z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
const sessionId = z.string().trim().min(1).max(256);
const note = z.string().trim().min(1).max(3000);
const command = z.string().trim().min(1).max(500);

const checks = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('passed'), command, evidence: note }),
  z.strictObject({ status: z.literal('failed'), command, evidence: note }),
  z.strictObject({ status: z.literal('not-run'), command, reason: note }),
]);

export const reviewSchema = z.strictObject({
  taskId: z.string(),
  base: objectId,
  tree: objectId,
  implementer: sessionId,
  reviewer: sessionId,
  verdict: z.enum(['approved', 'changes-requested']),
  authorReview: note,
  reviewSummary: note,
  checks: z.array(checks).min(1).max(20),
});

export type DeliveryReview = z.infer<typeof reviewSchema>;

const taskFields = {
  id: z.string(),
  worktree: z.string(),
  branch: z.string(),
  branchPrefix: z.string().optional(),
  target: z.string(),
  base: objectId,
  allowedPaths: z.array(z.string()).min(1),
  contextPaths: z.array(z.string()),
  approval: z.strictObject({ commit: objectId, review: reviewSchema }).optional(),
};

const taskSchema = z.union([
  z.strictObject({ ...taskFields, mode: z.literal('local'), targetWorktree: z.string(), merged: objectId.optional() }),
  z.strictObject({ ...taskFields, provider: gitProviderSchema, remote: z.string(), remoteIdentity: z.string(),
    publication: z.discriminatedUnion('status', [
    z.strictObject({ status: z.literal('opened'), commit: objectId, url: z.url() }),
    z.strictObject({ status: z.literal('requested-unconfirmed'), commit: objectId, branch: z.string(), reason: z.string() }),
    ]).optional(),
  }),
]);

export type DeliveryTask = z.infer<typeof taskSchema>;

export function parseTask(text: string): DeliveryTask {
  const result = taskSchema.safeParse(JSON.parse(text));
  if (!result.success) throw new Error('Invalid KeaveAI delivery state.');
  return result.data;
}

export function parseReview(text: string): DeliveryReview {
  const result = reviewSchema.safeParse(JSON.parse(text));
  if (!result.success) {
    const fields = result.error.issues.map(issue => issue.path.join('.') || '(root)');
    throw new Error(`Invalid review record fields: ${fields.join(', ')}.`);
  }
  return result.data;
}

export function taskBranch(id: string, prefix = 'keaveai/task'): string {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(id)) {
    throw new Error('Use a task ID of 1–64 lowercase letters, digits or hyphens, starting and ending with a letter or digit.');
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*(?:\/[a-zA-Z0-9][a-zA-Z0-9_.-]*)*$/.test(prefix)) {
    throw new Error('Use a branch prefix such as keaveai/task or dev/my-bot.');
  }
  return `${prefix}/${id}`;
}

export function repoPath(value: string): string {
  const parts = value.split('/');
  if (value.startsWith('-') || value.includes('\\') || value.includes(':') ||
      [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
      parts.some(part => !part || part === '.' || part === '..' || part.toLowerCase() === '.git')) {
    throw new Error('Use literal repository-relative paths separated by /, without . or .. segments.');
  }
  return value;
}

export function assertReview(review: DeliveryReview, task: DeliveryTask, tree: string): void {
  if (review.taskId !== task.id || review.base !== task.base || review.tree !== tree) {
    throw new Error('Review does not match this task, base and staged tree. Review the current snapshot again.');
  }
  if (review.implementer === review.reviewer || review.verdict !== 'approved') {
    throw new Error('Approval from a separate review agent is required.');
  }
  if (review.checks.some(check => check.status === 'failed')) {
    throw new Error('An approved review cannot contain a failed verification check.');
  }
}

export function reviewDescription(commit: string, review: DeliveryReview): string {
  const checks = review.checks.map(check => check.status === 'not-run'
    ? `- 未运行：${check.command} — ${check.reason}`
    : `- 通过：${check.command} — ${check.evidence}`);
  return [
    `提交：${commit}`,
    `## 自审\n${review.authorReview}`,
    `## 独立审查\n${review.reviewSummary}`,
    `## 验证\n${checks.join('\n')}`,
  ].join('\n\n');
}
