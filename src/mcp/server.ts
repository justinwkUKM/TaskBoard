import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TaskBoardApiClient, type TaskBoardClientConfig } from './client';
import { structuredReviewReportSchema } from '../lib/validation';

export function createTaskBoardMcpServer(config: TaskBoardClientConfig): McpServer {
  const client = new TaskBoardApiClient(config);
  const server = new McpServer({
    name: 'taskboard-mcp',
    version: '1.0.0'
  });

  // 1. taskboard_get_task
  server.tool(
    'taskboard_get_task',
    'Retrieve full task specifications, requirements, acceptance criteria, and column workflow details from TaskBoard.',
    {
      taskId: z.string().describe('The Task ID to inspect.')
    },
    async ({ taskId }) => {
      try {
        const result = await client.getTask(taskId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to fetch task: ${err instanceof Error ? err.message : String(err)}` }]
        };
      }
    }
  );

  // 2. taskboard_claim_task
  server.tool(
    'taskboard_claim_task',
    'Acquire an atomic transactional lease on a TaskBoard card. Transitions task to In Progress, provisions attempt run record, and assigns git branch.',
    {
      taskId: z.string().describe('The Task ID to claim.'),
      baseCommit: z.string().describe('The base git commit SHA from which the worktree/branch is created.'),
      targetBranch: z.string().optional().describe('The target branch to merge into (default: main).'),
      worktreePath: z.string().optional().describe('The local filesystem worktree path.')
    },
    async ({ taskId, baseCommit, targetBranch, worktreePath }) => {
      try {
        const result = await client.claimTask(taskId, {
          baseCommit,
          targetBranch,
          worktreePath
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: `Task ${taskId} claimed successfully. Active run initialized.`,
                  ...result
                },
                null,
                2
              )
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to claim task: ${err instanceof Error ? err.message : String(err)}` }]
        };
      }
    }
  );

  // 3. taskboard_heartbeat
  server.tool(
    'taskboard_heartbeat',
    'Send execution heartbeat to extend the 90-second lease window. Call every 30 seconds while performing work.',
    {
      runId: z.string().describe('The active run ID obtained during claim.'),
      revision: z.number().optional().describe('Expected task revision number.')
    },
    async ({ runId, revision }) => {
      try {
        const result = await client.heartbeat(runId, revision);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Heartbeat failed: ${err instanceof Error ? err.message : String(err)}` }]
        };
      }
    }
  );

  // 4. taskboard_record_log
  server.tool(
    'taskboard_record_log',
    'Record a structured progress or milestone log event into TaskBoard execution run telemetry.',
    {
      runId: z.string().describe('The active run ID.'),
      level: z.enum(['info', 'warn', 'milestone', 'error']).default('info').describe('Log severity.'),
      message: z.string().describe('Log description.'),
      metadata: z.record(z.string(), z.unknown()).optional().describe('Optional arbitrary key-value telemetry data.')
    },
    async ({ runId, level, message, metadata }) => {
      try {
        const result = await client.recordLog(runId, level, message, metadata);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to record log: ${err instanceof Error ? err.message : String(err)}` }]
        };
      }
    }
  );

  // 5. taskboard_ask_human_question
  server.tool(
    'taskboard_ask_human_question',
    'Pause execution and transition the task to Blocked/Needs Input to ask a human collaborator for necessary business logic or clarification.',
    {
      runId: z.string().describe('The active run ID.'),
      question: z.string().describe('The specific question for the human collaborator.'),
      context: z.string().optional().describe('Optional context or code snippets explaining the dilemma.')
    },
    async ({ runId, question, context }) => {
      try {
        const result = await client.askHumanQuestion(runId, question, context);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: 'Task flagged as blocked. Human collaborators notified.',
                  ...result
                },
                null,
                2
              )
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to ask human question: ${err instanceof Error ? err.message : String(err)}` }]
        };
      }
    }
  );

  // 6. taskboard_submit_for_review
  // Security Note: There is intentionally NO taskboard_mark_done tool. The transition to Done is strictly reserved
  // for authorized human review or verified VCS pull request merge webhooks.
  server.tool(
    'taskboard_submit_for_review',
    'Submit objective verification evidence (tests run, exit codes, git commits, PR link) and transition task to Ready for Review. Releases execution lease.',
    {
      runId: z.string().describe('The active run ID.'),
      report: structuredReviewReportSchema.describe('Complete structured review report.')
    },
    async ({ runId, report }) => {
      try {
        const result = await client.submitReview(runId, report);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: 'Verification passed and review successfully submitted. Task moved to Ready for Review.',
                  ...result
                },
                null,
                2
              )
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to submit review: ${err instanceof Error ? err.message : String(err)}` }]
        };
      }
    }
  );

  return server;
}
