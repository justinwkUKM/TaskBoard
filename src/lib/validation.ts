import { z } from 'zod';
export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export const nameSchema = z.string().trim().min(1, 'Please enter a name.').max(100);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, 'Enter a valid calendar date.').nullable();
export const boardCreateSchema = z.object({ id: z.string().uuid(), name: nameSchema, description: z.string().trim().max(1000).default('') });
export const boardEditSchema = z.object({ name: nameSchema, description: z.string().trim().max(1000), revision: z.number().int().nonnegative() });
export const taskFields = z.object({ title: z.string().trim().min(1, 'Enter a task title.').max(200), description: z.string().max(10000).default(''), columnId: idSchema, priority: z.enum(['none', 'low', 'medium', 'high']).default('none'), dueDate: dateSchema.default(null), assigneeId: idSchema.nullable().default(null) });
export const taskCreateSchema = taskFields.extend({ id: z.string().uuid() });
export const taskEditSchema = taskFields.extend({ revision: z.number().int().nonnegative() });
export const moveSchema = z.object({ action: z.literal('move'), columnId: idSchema, beforeId: idSchema.nullable(), revision: z.number().int().nonnegative(), boardRevision: z.number().int().nonnegative() });
export const columnSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), name: nameSchema, id: z.string().uuid(), revision: z.number().int() }),
  z.object({ action: z.literal('rename'), id: idSchema, name: nameSchema, revision: z.number().int() }),
  z.object({ action: z.literal('reorder'), ids: z.array(idSchema).max(20), revision: z.number().int() }),
  z.object({ action: z.literal('delete'), id: idSchema, destinationId: idSchema.nullable(), revision: z.number().int() }),
]);
export const aiGenerateSchema = z.object({
  prompt: z.string().trim().min(2, 'Please enter a description or speaking prompt.').max(10000),
  boardId: idSchema.optional(),
  apiKey: z.string().trim().max(256).optional()
});
export const taskBatchSchema = z.object({
  tasks: z.array(z.object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10000).default(''),
    columnId: idSchema,
    priority: z.enum(['none', 'low', 'medium', 'high']).default('none'),
    dueDate: dateSchema.default(null),
    assigneeId: idSchema.nullable().default(null)
  })).min(1, 'No tasks to add.').max(50, 'Cannot add more than 50 tasks at once.')
});

export const agentTokenCreateSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name for this agent or token.').max(64)
});

export const agentClaimTaskSchema = z.object({
  baseCommit: z.string().trim().min(1, 'Base commit is required.').max(64),
  targetBranch: z.string().trim().min(1).max(128).default('main'),
  worktreePath: z.string().trim().max(500).optional(),
  limits: z.object({
    maxDurationSeconds: z.number().int().positive().max(7200).default(1800),
    maxTurns: z.number().int().positive().max(100).optional()
  }).optional()
});

export const agentHeartbeatSchema = z.object({
  revision: z.number().int().nonnegative().optional()
});

export const agentLogSchema = z.object({
  level: z.enum(['info', 'warn', 'milestone', 'error']).default('info'),
  message: z.string().trim().min(1, 'Log message cannot be empty.').max(5000),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const agentQuestionSchema = z.object({
  question: z.string().trim().min(1, 'Question text cannot be empty.').max(2000),
  context: z.string().trim().max(5000).optional()
});

export const agentAnswerQuestionSchema = z.object({
  answer: z.string().trim().min(1, 'Answer cannot be empty.').max(5000)
});

export const structuredReviewReportSchema = z.object({
  summary: z.string().trim().min(1, 'Summary of work is required.').max(5000),
  baseCommit: z.string().trim().min(1, 'Base commit is required.').max(64),
  headCommit: z.string().trim().min(1, 'Head commit is required.').max(64),
  pullRequestUrl: z.string().url('A valid PR URL is required.').max(500).optional().nullable(),
  branchName: z.string().trim().min(1, 'Branch name is required.').max(128),
  verification: z.array(z.object({
    command: z.string().trim().min(1).max(500),
    exitCode: z.number().int(),
    durationMs: z.number().nonnegative().default(0),
    outputSnippet: z.string().max(10000).default('')
  })).min(1, 'At least one automated test/verification command result is required.'),
  criteriaChecklist: z.array(z.object({
    criterion: z.string().trim().min(1).max(500),
    satisfied: z.boolean(),
    explanation: z.string().trim().max(1000).default('')
  })).default([]),
  filesChanged: z.array(z.object({
    path: z.string().trim().min(1).max(500),
    changeType: z.enum(['added', 'modified', 'deleted']),
    insertions: z.number().int().nonnegative().default(0),
    deletions: z.number().int().nonnegative().default(0)
  })).default([]),
  knownLimitations: z.array(z.string().trim().max(1000)).max(20).optional()
});

export const vcsWebhookSchema = z.object({
  event: z.string().optional(),
  action: z.string().optional(),
  pull_request: z.object({
    html_url: z.string().optional(),
    url: z.string().optional(),
    merged: z.boolean().optional(),
    state: z.string().optional(),
    head: z.object({
      ref: z.string().optional(),
      sha: z.string().optional()
    }).optional(),
    title: z.string().optional()
  }).optional(),
  ref: z.string().optional(),
  taskId: idSchema.optional()
});


