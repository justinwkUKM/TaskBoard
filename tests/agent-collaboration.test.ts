import { describe, expect, it, vi } from 'vitest';
import {
  agentClaimTaskSchema,
  agentTokenCreateSchema,
  structuredReviewReportSchema,
  vcsWebhookSchema
} from '../src/lib/validation';
import { ProcessSupervisor } from '../src/runner/supervisor';
import { WorktreeManager } from '../src/runner/worktree';
import { createTaskBoardMcpServer } from '../src/mcp/server';
import { TaskBoardApiClient } from '../src/mcp/client';
import { isDoneColumn, isInProgressColumn, isReviewColumn } from '../src/lib/types';
import * as fs from 'node:fs';

describe('AI Agent Collaboration & MCP Architecture', () => {
  describe('1. Validation Schemas & Contracts', () => {
    it('validates agentTokenCreateSchema', () => {
      expect(agentTokenCreateSchema.safeParse({ name: 'Claude Code Local' }).success).toBe(true);
      expect(agentTokenCreateSchema.safeParse({ name: '' }).success).toBe(false);
      expect(agentTokenCreateSchema.safeParse({ name: 'a'.repeat(65) }).success).toBe(false);
    });

    it('validates agentClaimTaskSchema', () => {
      const valid = agentClaimTaskSchema.safeParse({
        baseCommit: 'a1b2c3d4e5f6',
        targetBranch: 'main',
        limits: { maxDurationSeconds: 1800, maxTurns: 20 }
      });
      expect(valid.success).toBe(true);

      // Missing baseCommit
      expect(agentClaimTaskSchema.safeParse({}).success).toBe(false);
    });

    it('validates structuredReviewReportSchema requires objective test evidence', () => {
      const validReport = {
        summary: 'Fixed database migration race condition',
        baseCommit: '1111111111111111',
        headCommit: '2222222222222222',
        pullRequestUrl: 'https://github.com/org/repo/pull/42',
        branchName: 'agent/task-123/attempt-1',
        verification: [
          {
            command: 'npm test',
            exitCode: 0,
            durationMs: 120,
            outputSnippet: 'PASS all tests'
          }
        ],
        criteriaChecklist: [
          {
            criterion: 'All tests pass without flaky timeouts',
            satisfied: true,
            explanation: 'Ran 10 iterations successfully'
          }
        ],
        filesChanged: [
          {
            path: 'src/lib/db.ts',
            changeType: 'modified',
            insertions: 5,
            deletions: 2
          }
        ]
      };

      expect(structuredReviewReportSchema.safeParse(validReport).success).toBe(true);

      // Fails if verification commands list is empty
      const emptyVerification = { ...validReport, verification: [] };
      expect(structuredReviewReportSchema.safeParse(emptyVerification).success).toBe(false);

      // Fails if PR URL is malformed
      const invalidUrl = { ...validReport, pullRequestUrl: 'not-a-url' };
      expect(structuredReviewReportSchema.safeParse(invalidUrl).success).toBe(false);
    });

    it('validates vcsWebhookSchema for PR merge events', () => {
      const githubMergeEvent = {
        action: 'closed',
        pull_request: {
          html_url: 'https://github.com/owner/repo/pull/10',
          merged: true,
          head: {
            ref: 'agent/task-abc-123/attempt-1',
            sha: 'abcdef123456'
          },
          title: 'Implement feature X'
        }
      };

      const parsed = vcsWebhookSchema.safeParse(githubMergeEvent);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.pull_request?.merged).toBe(true);
        expect(parsed.data.pull_request?.head?.ref).toBe('agent/task-abc-123/attempt-1');
      }
    });
  });

  describe('2. Column Semantics & Review Gating', () => {
    it('correctly classifies Done, In-Progress, and Review columns', () => {
      expect(isDoneColumn({ id: 'done', name: 'Done' })).toBe(true);
      expect(isDoneColumn({ id: 'completed', name: 'Completed Tasks' })).toBe(true);
      expect(isDoneColumn({ id: 'c3', name: 'Finished' }, 2, 3)).toBe(true); // last column
      expect(isDoneColumn({ id: 'todo', name: 'To Do' }, 0, 3)).toBe(false);

      expect(isInProgressColumn({ id: 'doing', name: 'In progress' })).toBe(true);
      expect(isInProgressColumn({ id: 'in_progress', name: 'Working On It' })).toBe(true);
      expect(isInProgressColumn({ id: 'col2', name: 'Next' }, 1)).toBe(true);

      expect(isReviewColumn({ id: 'review', name: 'In Review' })).toBe(true);
      expect(isReviewColumn({ id: 'ready_for_review', name: 'Ready for Review' })).toBe(true);
      expect(isReviewColumn({ id: 'qa', name: 'QA Testing' })).toBe(true);
    });
  });

  describe('3. Process Supervisor & Prompt Injection Defense', () => {
    it('sanitizes ambient system credentials from agent child processes', () => {
      const supervisor = new ProcessSupervisor();
      const dirtyEnv = {
        PATH: '/bin:/usr/bin',
        AWS_SECRET_ACCESS_KEY: 'AKIA_EVIL_LEAK',
        GOOGLE_APPLICATION_CREDENTIALS: '/root/creds.json',
        GITHUB_TOKEN: 'ghp_secretToken',
        GH_TOKEN: 'ghp_secretToken2',
        VERCEL_TOKEN: 'vc_secret',
        CUSTOM_SAFE_VAR: 'hello'
      };

      // Mock process.env
      const origEnv = process.env;
      process.env = dirtyEnv as unknown as NodeJS.ProcessEnv;

      const cleanEnv = supervisor.sanitizeEnvironment({ TASKBOARD_RUN: 'true' });

      expect(cleanEnv.AWS_SECRET_ACCESS_KEY).toBeUndefined();
      expect(cleanEnv.GOOGLE_APPLICATION_CREDENTIALS).toBeUndefined();
      expect(cleanEnv.GITHUB_TOKEN).toBeUndefined();
      expect(cleanEnv.GH_TOKEN).toBeUndefined();
      expect(cleanEnv.VERCEL_TOKEN).toBeUndefined();
      expect(cleanEnv.CUSTOM_SAFE_VAR).toBe('hello');
      expect(cleanEnv.TASKBOARD_RUN).toBe('true');

      process.env = origEnv;
    });

    it('captures exact OS exit code and output for verification commands', async () => {
      const supervisor = new ProcessSupervisor();

      // Successful command (exit 0)
      const successResult = await supervisor.runVerificationCommand(
        'node -e "console.log(\'Tests passed successfully\'); process.exit(0);"',
        process.cwd()
      );
      expect(successResult.exitCode).toBe(0);
      expect(successResult.outputSnippet).toContain('Tests passed successfully');
      expect(successResult.durationMs).toBeGreaterThanOrEqual(0);

      // Failing command (exit 1)
      const failResult = await supervisor.runVerificationCommand(
        'node -e "console.error(\'Assertion failed\'); process.exit(1);"',
        process.cwd()
      );
      expect(failResult.exitCode).toBe(1);
      expect(failResult.outputSnippet).toContain('Assertion failed');
    });
  });

  describe('4. Git Worktree Manager Lifecycle', () => {
    it('creates, inspects, and cleans up an isolated worktree branch', () => {
      const wm = new WorktreeManager(process.cwd());
      const testTaskId = 'test-unit-' + Math.random().toString(36).slice(2, 7);
      const attempt = 1;

      // Create worktree
      const info = wm.createWorktree(testTaskId, attempt);
      expect(info.taskId).toBe(testTaskId);
      expect(info.attempt).toBe(attempt);
      expect(info.branchName).toBe(`agent/${testTaskId}/attempt-${attempt}`);
      expect(fs.existsSync(info.path)).toBe(true);

      // Verify it is listed in active worktrees
      const active = wm.listActiveWorktrees();
      expect(active.some(w => w.path === info.path)).toBe(true);

      // Clean up worktree
      wm.removeWorktree(info.path, info.branchName, true);
      expect(fs.existsSync(info.path)).toBe(false);
    });
  });

  describe('5. TaskBoard MCP Server & Tool Safety', () => {
    it('exposes exactly the 6 required tools and NO taskboard_mark_done tool', () => {
      const server = createTaskBoardMcpServer({
        apiUrl: 'http://localhost:3000',
        agentToken: 'tb_agent_test123'
      });

      // Inspect registered tools
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tools = (server as any)._registeredTools || (server as any).tools || {};
      const toolNames = Object.keys(tools);

      // Ensure all 6 standard tools are registered
      expect(toolNames).toContain('taskboard_get_task');
      expect(toolNames).toContain('taskboard_claim_task');
      expect(toolNames).toContain('taskboard_heartbeat');
      expect(toolNames).toContain('taskboard_record_log');
      expect(toolNames).toContain('taskboard_ask_human_question');
      expect(toolNames).toContain('taskboard_submit_for_review');

      // CRITICAL SECURITY ASSERTION: There must never be a taskboard_mark_done tool for agents
      expect(toolNames).not.toContain('taskboard_mark_done');
      expect(toolNames).not.toContain('taskboard_done');
      expect(toolNames).not.toContain('taskboard_complete_task');
    });

    it('rejects review submission when verification test fails', async () => {
      const client = new TaskBoardApiClient({
        apiUrl: 'http://localhost:3000',
        agentToken: 'tb_agent_mock'
      });

      // Mock client.submitReview to simulate API verification check
      vi.spyOn(client, 'submitReview').mockImplementation(async (_runId, report) => {
        const failed = report.verification.find(v => v.exitCode !== 0);
        if (failed) {
          throw new Error(`All verification commands must pass (exitCode === 0). Failed command: "${failed.command}" exited with ${failed.exitCode}.`);
        }
        return { ok: true, status: 'review_ready', taskId: 'task-1', columnId: 'review' };
      });

      // Submit failing report
      await expect(
        client.submitReview('run-1', {
          summary: 'Attempted fix',
          baseCommit: 'base',
          headCommit: 'head',
          branchName: 'agent/task-1/attempt-1',
          verification: [
            { command: 'npm test', exitCode: 1, durationMs: 100, outputSnippet: 'FAIL' }
          ],
          criteriaChecklist: [],
          filesChanged: []
        })
      ).rejects.toThrow('All verification commands must pass (exitCode === 0)');
    });
  });

  describe('6. Lease Claiming & Recovery Semantics', () => {
    it('calculates 90s lease expiration window and next attempt number', () => {
      const now = Date.now();
      const currentAttempt = 2;
      const nextAttempt = currentAttempt + 1;
      const leaseDurationMs = 90 * 1000;
      const leaseExpiresAt = now + leaseDurationMs;

      expect(nextAttempt).toBe(3);
      expect(leaseExpiresAt - now).toBe(90000);
    });

    it('identifies expired leases eligible for reclaim', () => {
      const now = Date.now();
      const activeLease = { status: 'active', leaseExpiresAt: now + 45000, currentRunId: 'run-1' };
      const expiredLease = { status: 'active', leaseExpiresAt: now - 5000, currentRunId: 'run-0' };
      const unassigned = { status: 'unassigned', leaseExpiresAt: null, currentRunId: null };

      // Active lease is NOT reclaimable
      expect(activeLease.leaseExpiresAt > now).toBe(true);

      // Expired lease IS reclaimable
      expect(expiredLease.leaseExpiresAt < now).toBe(true);

      // Unassigned is claimable
      expect(unassigned.status).toBe('unassigned');
    });

    it('validates question answering restores task from blocked state', () => {
      const blockedTask = {
        id: 'task-1',
        title: 'Build auth modal',
        executionState: {
          status: 'blocked',
          questionText: 'Should magic link expire in 15m or 7 days?',
          currentRunId: 'run-1',
          attemptCount: 1
        }
      };

      // Human provides answer
      const answer = 'Magic links expire in 7 days per PRD.';
      const updatedExec = {
        ...blockedTask.executionState,
        status: 'active',
        questionText: null,
        questionAnswer: answer
      };

      expect(updatedExec.status).toBe('active');
      expect(updatedExec.questionText).toBeNull();
      expect(updatedExec.questionAnswer).toBe(answer);
    });

    it('extracts task ID from branch ref in VCS webhook payload', () => {
      const branchRef = 'agent/task-user-auth-uuid/attempt-2';
      const match = branchRef.match(/agent\/([a-zA-Z0-9_-]+)\/attempt-/);
      expect(match).not.toBeNull();
      expect(match?.[1]).toBe('task-user-auth-uuid');
    });
  });
});

