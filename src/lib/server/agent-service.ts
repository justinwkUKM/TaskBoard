import { createHash, randomBytes } from 'node:crypto';
import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import { admin } from './admin';
import { ApiError, assert, type AuthContext } from './auth';
import {
  agentClaimTaskSchema,
  agentHeartbeatSchema,
  agentLogSchema,
  agentQuestionSchema,
  agentAnswerQuestionSchema,
  agentTokenCreateSchema,
  structuredReviewReportSchema,
  vcsWebhookSchema,
  idSchema
} from '../validation';
import {
  LIMITS,
  isDoneColumn,
  isInProgressColumn,
  isReviewColumn,
  type Board,
  type Task,
  type Member,
  type AgentToken,
  type ExecutionRun
} from '../types';

const stamp = () => FieldValue.serverTimestamp();
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

function touch(ref: DocumentReference, board: Board, extra = {}) {
  return { revision: board.revision + 1, updatedAt: stamp(), ...extra };
}

/**
 * Manage Scoped Agent Tokens in Board Settings
 * POST   /api/boards/[boardId]/agent-tokens -> generate new token
 * GET    /api/boards/[boardId]/agent-tokens -> list active tokens
 * DELETE /api/boards/[boardId]/agent-tokens/[tokenId] -> revoke token
 */
export async function handleAgentTokens(
  user: AuthContext,
  boardRef: DocumentReference,
  method: string,
  segments: string[],
  input: unknown
): Promise<unknown> {
  const { db } = admin();
  const boardSnap = await boardRef.get();
  const board = boardSnap.data() as Board;
  assert(board && !board.deleting, 404, 'Board not found.');

  if (method === 'GET') {
    assert(board.memberIds.includes(user.uid), 403, 'Must be a board member to view agent tokens.');
    const snap = await db.collection('agent_tokens').where('boardId', '==', boardRef.id).get();
    const tokens = snap.docs
      .map(doc => doc.data() as AgentToken)
      .filter(t => !t.revokedAt)
      .map(t => ({
        id: t.id,
        name: t.name,
        tokenPrefix: t.tokenPrefix,
        createdAt: t.createdAt
      }));
    return { tokens };
  }

  if (method === 'POST') {
    assert(board.ownerId === user.uid, 403, 'Only board owner can generate agent tokens.');
    const data = agentTokenCreateSchema.parse(input);

    const activeSnap = await db.collection('agent_tokens').where('boardId', '==', boardRef.id).get();
    const activeCount = activeSnap.docs.filter(d => !d.data().revokedAt).length;
    assert(activeCount < LIMITS.agentTokens, 422, `You can have up to ${LIMITS.agentTokens} active agent tokens per board.`);

    const id = crypto.randomUUID();
    const rawToken = `tb_agent_${randomBytes(24).toString('base64url')}`;
    const tokenHash = hash(rawToken);
    const tokenPrefix = `tb_agent_${rawToken.slice(9, 17)}...`;
    const now = Date.now();

    const record: AgentToken = {
      id,
      name: data.name,
      tokenHash,
      tokenPrefix,
      boardId: boardRef.id,
      createdBy: user.uid,
      createdAt: now,
      revokedAt: null
    };

    const lowerName = data.name.toLowerCase();
    let provider: NonNullable<Member['agentConfig']>['provider'] = 'custom';
    if (lowerName.includes('antigravity') || lowerName.includes('gemini')) provider = 'antigravity';
    else if (lowerName.includes('codex') || lowerName.includes('openai')) provider = 'codex';
    else if (lowerName.includes('claude')) provider = 'claude-code';
    else if (lowerName.includes('opencode')) provider = 'opencode';
    else if (lowerName.includes('cursor')) provider = 'cursor';

    await db.runTransaction(async tx => {
      tx.set(db.collection('agent_tokens').doc(tokenHash), record);
      // Register agent persona as a board member
      const memberRef = boardRef.collection('members').doc(id);
      tx.set(memberRef, {
        id,
        name: data.name,
        photoURL: null,
        role: 'member',
        type: 'agent',
        agentConfig: {
          provider,
          runtime: 'local-runner',
          capabilities: ['typescript', 'mcp']
        },
        status: 'idle',
        lastSeenAt: now
      });
      // Add to board memberIds if not present
      if (!board.memberIds.includes(id)) {
        tx.update(boardRef, touch(boardRef, board, { memberIds: [...board.memberIds, id] }));
      }
    });

    return {
      id,
      name: data.name,
      token: rawToken, // Returned only once!
      tokenPrefix,
      createdAt: now
    };
  }

  if (method === 'DELETE' && segments.length === 4) {
    assert(board.ownerId === user.uid, 403, 'Only board owner can revoke agent tokens.');
    const tokenId = idSchema.parse(segments[3]);
    const tokensSnap = await db.collection('agent_tokens').where('boardId', '==', boardRef.id).where('id', '==', tokenId).get();
    assert(!tokensSnap.empty, 404, 'Agent token not found.');

    const tokenDoc = tokensSnap.docs[0];
    await db.runTransaction(async tx => {
      tx.update(tokenDoc.ref, { revokedAt: Date.now() });
      const memberRef = boardRef.collection('members').doc(tokenId);
      tx.set(memberRef, { status: 'offline', lastSeenAt: Date.now() }, { merge: true });
    });

    return { ok: true };
  }

  throw new ApiError(404, 'Endpoint not found.');
}

/**
 * Handle Agent API v1
 * - GET    /api/agent/v1/tasks
 * - GET    /api/agent/v1/tasks/[taskId]
 * - POST   /api/agent/v1/tasks/[taskId]/claim
 * - POST   /api/agent/v1/runs/[runId]/heartbeat
 * - POST   /api/agent/v1/runs/[runId]/log
 * - POST   /api/agent/v1/runs/[runId]/question
 * - POST   /api/agent/v1/runs/[runId]/submit-review
 */
export async function handleAgentV1(
  user: AuthContext,
  method: string,
  segments: string[],
  input: unknown
): Promise<unknown> {
  const { db } = admin();
  // Target board ID is either from scoped agent token or query/body
  const boardId = user.boardId || (typeof input === 'object' && input && 'boardId' in input ? String((input as Record<string, unknown>).boardId) : null);
  assert(boardId, 400, 'Board ID is required. Scoped agent tokens automatically provide board ID.');

  const boardRef = db.collection('boards').doc(boardId);

  // 1. GET /api/agent/v1/tasks -> list actionable tasks
  if (segments.length === 3 && segments[2] === 'tasks' && method === 'GET') {
    const boardSnap = await boardRef.get();
    const board = boardSnap.data() as Board;
    assert(board && !board.deleting, 404, 'Board not found.');

    const tasksSnap = await boardRef.collection('tasks').get();
    const now = Date.now();

    const actionable = tasksSnap.docs
      .map(d => ({ ...d.data(), id: d.id } as Task))
      .filter(t => {
        // Exclude done column tasks
        const col = board.columns.find(c => c.id === t.columnId);
        if (isDoneColumn(col)) return false;

        const exec = t.executionState;
        if (!exec || exec.status === 'unassigned') return true;
        // Lease expired? Can be reclaimed
        if (exec.leaseExpiresAt && exec.leaseExpiresAt < now && exec.status !== 'done' && exec.status !== 'review_ready') {
          return true;
        }
        // Assigned specifically to this agent
        if (t.assigneeId === user.agentId || t.assigneeId === 'agent-pool') {
          return exec.status !== 'review_ready' && exec.status !== 'done';
        }
        return false;
      });

    return {
      tasks: actionable.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        columnId: t.columnId,
        assigneeId: t.assigneeId,
        revision: t.revision,
        executionState: t.executionState || { status: 'unassigned', attemptCount: 0 }
      })),
      board: {
        id: board.id,
        name: board.name,
        columns: board.columns
      }
    };
  }

  // 2. GET /api/agent/v1/tasks/[taskId] -> get single task context
  if (segments.length === 4 && segments[2] === 'tasks' && method === 'GET') {
    const taskId = idSchema.parse(segments[3]);
    const [boardSnap, taskSnap] = await Promise.all([
      boardRef.get(),
      boardRef.collection('tasks').doc(taskId).get()
    ]);
    const board = boardSnap.data() as Board;
    const task = taskSnap.data() as Task;
    assert(board && !board.deleting && task, 404, 'Task not found.');

    return {
      task: {
        ...task,
        id: taskSnap.id,
        executionState: task.executionState || { status: 'unassigned', attemptCount: 0 }
      },
      board: {
        id: board.id,
        name: board.name,
        columns: board.columns
      }
    };
  }

  // 3. POST /api/agent/v1/tasks/[taskId]/claim -> acquire transactional lease
  if (segments.length === 5 && segments[2] === 'tasks' && segments[4] === 'claim' && method === 'POST') {
    const taskId = idSchema.parse(segments[3]);
    const data = agentClaimTaskSchema.parse(input);
    const taskRef = boardRef.collection('tasks').doc(taskId);

    return db.runTransaction(async tx => {
      const [boardSnap, taskSnap] = await Promise.all([tx.get(boardRef), tx.get(taskRef)]);
      const board = boardSnap.data() as Board;
      const task = taskSnap.data() as Task;
      assert(board && !board.deleting, 404, 'Board not found.');
      assert(task, 404, 'Task not found.');

      const now = Date.now();
      const currentExec = task.executionState || { status: 'unassigned', attemptCount: 0 };

      // Precondition checks: lease active?
      if (currentExec.currentRunId && currentExec.leaseExpiresAt && currentExec.leaseExpiresAt > now) {
        throw new ApiError(409, `Task is actively leased by run ${currentExec.currentRunId} until ${new Date(currentExec.leaseExpiresAt).toISOString()}.`);
      }
      assert(currentExec.status !== 'done', 409, 'Cannot claim completed task.');
      assert(currentExec.status !== 'review_ready', 409, 'Task is awaiting review and cannot be claimed.');

      // Find in-progress column
      const inProgressCol = board.columns.find((c, i) => isInProgressColumn(c, i)) ||
        board.columns[Math.min(1, board.columns.length - 1)];

      const attempt = (currentExec.attemptCount || 0) + 1;
      const runId = crypto.randomUUID();
      const branchName = `agent/${taskId}/attempt-${attempt}`;
      const leaseDuration = 90 * 1000; // 90 seconds
      const leaseExpiresAt = now + leaseDuration;

      // Update Task execution state & move to in-progress column
      tx.update(taskRef, {
        columnId: inProgressCol.id,
        assigneeId: user.agentId || task.assigneeId || user.uid,
        executionState: {
          status: 'active',
          currentRunId: runId,
          leaseExpiresAt,
          attemptCount: attempt,
          activeBranch: branchName,
          pullRequestUrl: null,
          reviewReport: null,
          questionText: null,
          questionContext: null,
          questionAnswer: null
        },
        revision: task.revision + 1,
        updatedAt: stamp()
      });

      // Record ExecutionRun subcollection document
      const runRef = taskRef.collection('runs').doc(runId);
      const runRecord: ExecutionRun = {
        runId,
        taskId,
        boardId: board.id,
        agentId: user.agentId || user.uid,
        attempt,
        status: 'active',
        baseCommit: data.baseCommit,
        targetBranch: data.targetBranch,
        headCommit: null,
        worktreePath: data.worktreePath || null,
        startedAt: now,
        leaseExpiresAt,
        limits: data.limits || { maxDurationSeconds: 1800 }
      };
      tx.create(runRef, runRecord);

      // Audit event
      const eventRef = runRef.collection('events').doc(crypto.randomUUID());
      tx.create(eventRef, {
        id: eventRef.id,
        runId,
        taskId,
        timestamp: now,
        level: 'milestone',
        message: `Task claimed by agent ${user.name || user.uid} for attempt #${attempt}. Base commit: ${data.baseCommit}.`
      });

      tx.update(boardRef, { updatedAt: stamp() });

      return {
        runId,
        taskId,
        boardId: board.id,
        attempt,
        branchName,
        baseCommit: data.baseCommit,
        targetBranch: data.targetBranch,
        leaseExpiresAt
      };
    });
  }

  // 4. Lookups for run-based endpoints: /runs/[runId]/...
  if (segments.length >= 5 && segments[2] === 'runs') {
    const runId = idSchema.parse(segments[3]);
    const action = segments[4];

    // Find task containing this runId
    const matchingTasks = await boardRef.collection('tasks').where('executionState.currentRunId', '==', runId).get();
    assert(!matchingTasks.empty, 404, `No active task found for runId ${runId}.`);
    const taskDoc = matchingTasks.docs[0];
    const taskRef = taskDoc.ref;
    const runRef = taskRef.collection('runs').doc(runId);

    // Heartbeat
    if (action === 'heartbeat' && method === 'POST') {
      const data = agentHeartbeatSchema.parse(input);
      const now = Date.now();
      const leaseExpiresAt = now + 90 * 1000;

      return db.runTransaction(async tx => {
        const currentTask = (await tx.get(taskRef)).data() as Task;
        assert(currentTask && currentTask.executionState?.currentRunId === runId, 409, 'Run lease was expired or revoked.');
        if (data.revision !== undefined) {
          assert(currentTask.revision === data.revision, 409, 'Task revision changed while working.');
        }

        tx.update(taskRef, {
          'executionState.leaseExpiresAt': leaseExpiresAt,
          updatedAt: stamp()
        });
        tx.update(runRef, {
          leaseExpiresAt,
          status: 'active'
        });

        return { ok: true, runId, leaseExpiresAt };
      });
    }

    // Append log event
    if (action === 'log' && method === 'POST') {
      const data = agentLogSchema.parse(input);
      const eventRef = runRef.collection('events').doc(crypto.randomUUID());
      await eventRef.set({
        id: eventRef.id,
        runId,
        taskId: taskDoc.id,
        timestamp: Date.now(),
        level: data.level,
        message: data.message,
        metadata: data.metadata || {}
      });
      return { ok: true, eventId: eventRef.id };
    }

    // Ask human question
    if (action === 'question' && method === 'POST') {
      const data = agentQuestionSchema.parse(input);
      return db.runTransaction(async tx => {
        const currentTask = (await tx.get(taskRef)).data() as Task;
        assert(currentTask && currentTask.executionState?.currentRunId === runId, 409, 'Run lease was expired or revoked.');

        tx.update(taskRef, {
          'executionState.status': 'blocked',
          'executionState.questionText': data.question,
          'executionState.questionContext': data.context || null,
          'executionState.questionAnswer': null,
          revision: currentTask.revision + 1,
          updatedAt: stamp()
        });

        const eventRef = runRef.collection('events').doc(crypto.randomUUID());
        tx.create(eventRef, {
          id: eventRef.id,
          runId,
          taskId: taskDoc.id,
          timestamp: Date.now(),
          level: 'warn',
          message: `Agent asked question: "${data.question}"`
        });

        return { ok: true, status: 'blocked', question: data.question };
      });
    }

    // Submit for review
    if (action === 'submit-review' && method === 'POST') {
      const report = structuredReviewReportSchema.parse(input);

      // Objective verification enforcement: every command must have exitCode === 0
      const failed = report.verification.find(v => v.exitCode !== 0);
      assert(!failed, 422, `All verification commands must pass (exitCode === 0). Failed command: "${failed?.command}" exited with ${failed?.exitCode}.`);

      return db.runTransaction(async tx => {
        const [boardSnap, currentTaskSnap] = await Promise.all([tx.get(boardRef), tx.get(taskRef)]);
        const board = boardSnap.data() as Board;
        const currentTask = currentTaskSnap.data() as Task;
        assert(currentTask && currentTask.executionState?.currentRunId === runId, 409, 'Run lease expired or reassigned.');

        // Find review column (or default in-progress)
        const reviewCol = board.columns.find(c => isReviewColumn(c)) ||
          board.columns.find((c, i) => isInProgressColumn(c, i)) ||
          board.columns[0];

        const now = Date.now();

        // Update task: move to review_ready, clear active lease
        tx.update(taskRef, {
          columnId: reviewCol.id,
          executionState: {
            status: 'review_ready',
            currentRunId: null,
            leaseExpiresAt: null,
            attemptCount: currentTask.executionState?.attemptCount || 1,
            activeBranch: report.branchName,
            pullRequestUrl: report.pullRequestUrl || null,
            reviewReport: report,
            questionText: null,
            questionContext: null,
            questionAnswer: currentTask.executionState?.questionAnswer || null
          },
          revision: currentTask.revision + 1,
          updatedAt: stamp()
        });

        // Update execution run document
        tx.update(runRef, {
          status: 'submitted',
          completedAt: now,
          headCommit: report.headCommit,
          terminationReason: 'completed'
        });

        // Audit milestone
        const eventRef = runRef.collection('events').doc(crypto.randomUUID());
        tx.create(eventRef, {
          id: eventRef.id,
          runId,
          taskId: taskDoc.id,
          timestamp: now,
          level: 'milestone',
          message: `Review submitted: ${report.summary} (${report.verification.length} tests passed, ${report.filesChanged.length} files changed).`
        });

        tx.update(boardRef, { updatedAt: stamp() });

        return {
          ok: true,
          status: 'review_ready',
          taskId: taskDoc.id,
          columnId: reviewCol.id,
          pullRequestUrl: report.pullRequestUrl
        };
      });
    }
  }

  throw new ApiError(404, 'Agent endpoint not found.');
}

/**
 * Human collaborator answers an agent question
 * POST /api/boards/[boardId]/tasks/[taskId]/answer
 */
export async function handleAnswerQuestion(
  user: AuthContext,
  boardRef: DocumentReference,
  taskId: string,
  input: unknown
): Promise<unknown> {
  const { db } = admin();
  const data = agentAnswerQuestionSchema.parse(input);
  const taskRef = boardRef.collection('tasks').doc(taskId);

  return db.runTransaction(async tx => {
    const [boardSnap, taskSnap] = await Promise.all([tx.get(boardRef), tx.get(taskRef)]);
    const board = boardSnap.data() as Board;
    const task = taskSnap.data() as Task;
    assert(board && !board.deleting && board.memberIds.includes(user.uid), 404, 'Board or task not found.');
    assert(task, 404, 'Task not found.');

    const currentExec = task.executionState;
    assert(currentExec?.questionText, 400, 'Task does not have a pending question.');

    // If active lease is still valid, resume 'active'; else 'unassigned' so agent can claim/resume
    const now = Date.now();
    const hasActiveLease = currentExec.currentRunId && currentExec.leaseExpiresAt && currentExec.leaseExpiresAt > now;

    tx.update(taskRef, {
      'executionState.questionAnswer': data.answer,
      'executionState.status': hasActiveLease ? 'active' : 'unassigned',
      'executionState.questionText': null,
      revision: task.revision + 1,
      updatedAt: stamp()
    });

    if (currentExec.currentRunId) {
      const eventRef = taskRef.collection('runs').doc(currentExec.currentRunId).collection('events').doc(crypto.randomUUID());
      tx.create(eventRef, {
        id: eventRef.id,
        runId: currentExec.currentRunId,
        taskId,
        timestamp: now,
        level: 'info',
        message: `Human answered question: "${data.answer}"`
      });
    }

    return { ok: true, answer: data.answer };
  });
}

/**
 * Handle VCS PR Merge Webhook
 * POST /api/webhooks/vcs
 */
export async function handleVcsWebhook(
  _user: AuthContext,
  input: unknown
): Promise<unknown> {
  const payload = vcsWebhookSchema.parse(input);
  const pr = payload.pull_request;

  // We only trigger when a pull request was actually merged
  const isMerged = Boolean(
    pr?.merged ||
    (payload.action === 'closed' && pr && pr.merged) ||
    (payload.event === 'pull_request.merged')
  );

  if (!isMerged) {
    return { ok: true, ignored: true, reason: 'Event is not a merged pull request.' };
  }

  const branchRef = pr?.head?.ref || payload.ref || '';
  const prUrl = pr?.html_url || pr?.url || '';

  // Extract task ID from branch pattern: agent/{taskId}/attempt-...
  const branchMatch = branchRef.match(/agent\/([a-zA-Z0-9_-]+)\/attempt-/);
  const targetTaskId = payload.taskId || (branchMatch ? branchMatch[1] : null);

  const { db } = admin();
  const candidateBoards = await db.collection('boards').get();

  for (const bDoc of candidateBoards.docs) {
    const board = bDoc.data() as Board;
    if (board.deleting) continue;

    let taskSnap;
    if (targetTaskId) {
      taskSnap = await bDoc.ref.collection('tasks').doc(targetTaskId).get();
    }

    // Also match by pullRequestUrl if task ID didn't resolve directly
    if (!taskSnap?.exists && prUrl) {
      const matched = await bDoc.ref.collection('tasks').where('executionState.pullRequestUrl', '==', prUrl).get();
      if (!matched.empty) taskSnap = matched.docs[0];
    }

    if (taskSnap?.exists) {
      const task = taskSnap.data() as Task;
      const doneCol = board.columns.find((c, i) => isDoneColumn(c, i, board.columns.length)) ||
        board.columns[board.columns.length - 1];

      await db.runTransaction(async tx => {
        tx.update(taskSnap.ref, {
          columnId: doneCol.id,
          executionState: {
            status: 'done',
            currentRunId: null,
            leaseExpiresAt: null,
            attemptCount: task.executionState?.attemptCount || 1,
            activeBranch: branchRef || task.executionState?.activeBranch || null,
            pullRequestUrl: prUrl || task.executionState?.pullRequestUrl || null,
            reviewReport: task.executionState?.reviewReport || null,
            questionText: null,
            questionContext: null,
            questionAnswer: task.executionState?.questionAnswer || null
          },
          revision: task.revision + 1,
          updatedAt: stamp()
        });

        if (task.executionState?.currentRunId) {
          const runRef = taskSnap.ref.collection('runs').doc(task.executionState.currentRunId);
          tx.update(runRef, {
            status: 'submitted',
            completedAt: Date.now(),
            terminationReason: 'completed'
          });
        }

        tx.update(bDoc.ref, { updatedAt: stamp() });
      });

      return {
        ok: true,
        taskId: taskSnap.id,
        boardId: bDoc.id,
        movedToDone: true,
        columnId: doneCol.id
      };
    }
  }

  return { ok: true, matched: false, reason: 'No matching TaskBoard card found for this PR.' };
}
