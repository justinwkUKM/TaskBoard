import { createHash, randomBytes } from 'node:crypto';
import { FieldValue, type Transaction, type DocumentReference } from 'firebase-admin/firestore';
import { z } from 'zod';
import { admin } from './admin';
import { assert, ApiError, type AuthContext } from './auth';
import { boardCreateSchema, boardEditSchema, columnSchema, idSchema, moveSchema, taskBatchSchema, taskCreateSchema, taskEditSchema, aiGenerateSchema } from '../validation';
import { LIMITS, isDoneColumn, type Board, type Task } from '../types';
import { generateTasksWithGemini } from './ai';
import { handleAgentTokens, handleAgentV1, handleAnswerQuestion, handleVcsWebhook } from './agent-service';

const stamp = () => FieldValue.serverTimestamp();
const profile = (user: AuthContext) => ({
  name: String(user.name || user.email?.split('@')[0] || (user.type === 'agent' ? user.name || 'AI Agent' : 'Member')).slice(0, 100),
  photoURL: typeof user.picture === 'string' && user.picture.startsWith('https://') ? user.picture : null
});
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
function revision(actual: number, expected: number) { assert(actual === expected, 409, 'This item changed while you were editing. Close and reopen it to load the latest version.'); }
function allowed(board: Board, user: AuthContext, owner = false) {
  assert(board && !board.deleting, 404, 'This board is unavailable or you no longer have access.');
  if (user.type === 'agent') {
    assert(!owner, 403, 'Agent tokens cannot perform board administrative actions.');
    assert(user.boardId === board.id, 403, 'This agent token is not authorized for this board.');
    return;
  }
  assert(board.memberIds.includes(user.uid), 404, 'This board is unavailable or you no longer have access.');
  if (owner) assert(board.ownerId === user.uid, 403, 'Only the board owner can do that.');
}
function touch(tx: Transaction, ref: DocumentReference, board: Board, extra = {}) { tx.update(ref, { revision: board.revision + 1, updatedAt: stamp(), ...extra }); }
function taskTarget(board: Board, data: { columnId: string; assigneeId: string | null }, user?: AuthContext) {
  assert(board.columns.some(c => c.id === data.columnId), 409, 'The selected column no longer exists.');
  assert(!data.assigneeId || data.assigneeId === 'agent-pool' || board.memberIds.includes(data.assigneeId) || (user?.type === 'agent' && user.agentId === data.assigneeId), 409, 'The selected person is no longer a member.');
  if (user?.type === 'agent') {
    const col = board.columns.find(c => c.id === data.columnId);
    assert(!isDoneColumn(col), 403, 'Agent tokens cannot move tasks directly to Done. Tasks must be submitted for review.');
  }
}

export async function dispatch(user: AuthContext, method: string, segments: string[], input: unknown): Promise<unknown> {
  const { db } = admin(); const uid = user.uid;

  // VCS Webhook
  if (segments[0] === 'webhooks' && segments[1] === 'vcs') {
    return handleVcsWebhook(user, input);
  }

  // Agent API v1
  if (segments[0] === 'agent' && segments[1] === 'v1') {
    return handleAgentV1(user, method, segments, input);
  }

  if (segments.join('/') === 'profile' && method === 'POST') {
    await db.collection('users').doc(uid).set({ ...profile(user), updatedAt: stamp() }, { merge: true });
    return { ok: true };
  }
  if (segments[0] === 'ai' && segments[1] === 'generate' && segments.length === 2 && method === 'POST') {
    const data = aiGenerateSchema.parse(input);
    let columns: Array<{ id: string; name: string }> = [];
    if (data.boardId) {
      const bSnap = await db.collection('boards').doc(data.boardId).get();
      const b = bSnap.data() as Board;
      if (b && !b.deleting && b.memberIds.includes(uid)) columns = b.columns;
    }
    return generateTasksWithGemini({ prompt: data.prompt, apiKey: data.apiKey, boardColumns: columns });
  }
  if (segments.join('/') === 'invitations/accept' && method === 'POST') return acceptInvite(user, input);
  if (segments.length === 1 && segments[0] === 'boards' && method === 'POST') {
    assert(user.type !== 'agent', 403, 'Agent tokens cannot create boards.');
    const data = boardCreateSchema.parse(input); const ref = db.collection('boards').doc(data.id); const userRef = db.collection('users').doc(uid);
    return db.runTransaction(async tx => {
      const [existing, account] = await Promise.all([tx.get(ref), tx.get(userRef)]);
      if (existing.exists) { assert(existing.data()?.ownerId === uid && !existing.data()?.deleting, 409, 'Board ID already exists.'); return { id: ref.id }; }
      const count = account.data()?.ownedBoards || 0;
      assert(count < LIMITS.boards, 422, `You can own up to ${LIMITS.boards} boards.`);
      tx.create(ref, { name: data.name, description: data.description, ownerId: uid, memberIds: [uid], columns: [{ id: 'todo', name: 'To do' }, { id: 'doing', name: 'In progress' }, { id: 'done', name: 'Done' }], taskCount: 0, revision: 0, deleting: false, createdAt: stamp(), updatedAt: stamp() });
      tx.create(ref.collection('members').doc(uid), { ...profile(user), role: 'owner' });
      tx.set(userRef, { ...profile(user), ownedBoards: count + 1, updatedAt: stamp() }, { merge: true });
      return { id: ref.id };
    });
  }
  assert(segments[0] === 'boards' && segments.length >= 2, 404, 'Endpoint not found.');
  const boardId = idSchema.parse(segments[1]); const ref = db.collection('boards').doc(boardId);
  if (segments.length === 2 && method === 'DELETE') return deleteBoard(uid, ref);
  if (segments[2] === 'invites' && segments.length === 3) return invitations(user, ref, method, input);
  if (segments[2] === 'agent-tokens') return handleAgentTokens(user, ref, method, segments, input);
  if (segments[2] === 'heartbeat' && segments.length === 3 && method === 'POST') {
    const boardSnap = await ref.get(); const board = boardSnap.data() as Board; allowed(board, user);
    await ref.collection('members').doc(uid).set({ ...profile(user), lastSeen: Date.now() }, { merge: true });
    return { ok: true };
  }
  return db.runTransaction(async tx => {
    const boardSnap = await tx.get(ref); const board = boardSnap.data() as Board;
    allowed(board, user);
    if (segments.length === 2 && method === 'PATCH') {
      allowed(board, user, true); const data = boardEditSchema.parse(input); revision(board.revision, data.revision);
      touch(tx, ref, board, { name: data.name, description: data.description }); return { ok: true };
    }
    if (segments[2] === 'members' && segments.length === 4 && method === 'DELETE') {
      const target = idSchema.parse(segments[3]);
      assert(target === uid || board.ownerId === uid, 403, 'Only the owner can remove other members.');
      assert(target !== board.ownerId, 422, 'The owner cannot leave the board.');
      const tasks = await tx.get(ref.collection('tasks').where('assigneeId', '==', target));
      if (!board.memberIds.includes(target)) return { ok: true };
      for (const task of tasks.docs) tx.update(task.ref, { assigneeId: null, revision: task.data().revision + 1, updatedAt: stamp() });
      tx.delete(ref.collection('members').doc(target));
      touch(tx, ref, board, { memberIds: board.memberIds.filter(id => id !== target) }); return { ok: true };
    }
    if (segments[2] === 'columns' && segments.length === 3 && ['POST', 'PATCH', 'DELETE'].includes(method)) {
      allowed(board, user, true); const data = columnSchema.parse(input); revision(board.revision, data.revision);
      const columns = [...board.columns];
      if (data.action === 'create') {
        assert(columns.length < LIMITS.columns, 422, `A board can have up to ${LIMITS.columns} columns.`);
        assert(!columns.some(c => c.id === data.id), 409, 'Column already exists.');
        columns.push({ id: data.id, name: data.name });
      } else if (data.action === 'rename') {
        const col = columns.find(c => c.id === data.id); assert(col, 404, 'Column not found.'); col.name = data.name;
      } else if (data.action === 'reorder') {
        assert(data.ids.length === columns.length && new Set(data.ids).size === columns.length && data.ids.every(id => columns.some(c => c.id === id)), 400, 'Invalid column order.');
        columns.sort((a, b) => data.ids.indexOf(a.id) - data.ids.indexOf(b.id));
      } else {
        assert(columns.length > 1 && columns.some(c => c.id === data.id), 422, 'Keep at least one column.');
        const tasks = await tx.get(ref.collection('tasks'));
        const moving = tasks.docs.filter(doc => doc.data().columnId === data.id).sort((a, b) => a.data().rank - b.data().rank);
        if (moving.length) {
          assert(data.destinationId !== data.id && columns.some(c => c.id === data.destinationId), 422, 'Choose another column for these tasks.');
          let rank = Math.max(0, ...tasks.docs.filter(d => d.data().columnId === data.destinationId).map(d => d.data().rank));
          for (const doc of moving) { rank += 1024; tx.update(doc.ref, { columnId: data.destinationId, rank, revision: doc.data().revision + 1, updatedAt: stamp() }); }
        }
        columns.splice(columns.findIndex(c => c.id === data.id), 1);
      }
      touch(tx, ref, board, { columns }); return { ok: true };
    }
    if (segments[2] === 'tasks' && segments[3] === 'batch' && segments.length === 4 && method === 'POST') {
      const data = taskBatchSchema.parse(input);
      assert(board.taskCount + data.tasks.length <= LIMITS.tasks, 422, `A board can hold up to ${LIMITS.tasks} tasks.`);
      const columnIds = new Set(data.tasks.map(t => t.columnId));
      for (const colId of columnIds) assert(board.columns.some(c => c.id === colId), 409, 'A selected column no longer exists.');
      const colRanks: Record<string, number> = {};
      for (const colId of columnIds) {
        const others = await tx.get(ref.collection('tasks').where('columnId', '==', colId));
        colRanks[colId] = Math.max(0, ...others.docs.map(t => t.data().rank));
      }
      const createdIds: string[] = [];
      for (const t of data.tasks) {
        const taskId = t.id || crypto.randomUUID();
        const taskRef = ref.collection('tasks').doc(taskId);
        const nextRank = (colRanks[t.columnId] || 0) + 1024;
        colRanks[t.columnId] = nextRank;
        tx.create(taskRef, {
          title: t.title,
          description: t.description || '',
          columnId: t.columnId,
          priority: t.priority || 'none',
          dueDate: t.dueDate || null,
          assigneeId: t.assigneeId || null,
          rank: nextRank,
          createdBy: uid,
          revision: 0,
          createdAt: stamp(),
          updatedAt: stamp()
        });
        createdIds.push(taskId);
      }
      touch(tx, ref, board, { taskCount: board.taskCount + data.tasks.length });
      return { ok: true, createdCount: createdIds.length, ids: createdIds };
    }
    if (segments[2] === 'tasks' && segments.length === 5 && segments[4] === 'answer' && method === 'POST') {
      return handleAnswerQuestion(user, ref, segments[3], input);
    }
    if (segments[2] === 'tasks' && segments.length === 5 && segments[4] === 'runs' && method === 'GET') {
      const taskId = idSchema.parse(segments[3]);
      const runs = await ref.collection('tasks').doc(taskId).collection('runs').orderBy('startedAt', 'desc').limit(20).get();
      return { runs: runs.docs.map(d => d.data()) };
    }
    if (segments[2] === 'tasks' && segments.length === 7 && segments[4] === 'runs' && segments[6] === 'events' && method === 'GET') {
      const taskId = idSchema.parse(segments[3]);
      const runId = idSchema.parse(segments[5]);
      const events = await ref.collection('tasks').doc(taskId).collection('runs').doc(runId).collection('events').orderBy('timestamp', 'asc').limit(100).get();
      return { events: events.docs.map(d => d.data()) };
    }
    if (segments[2] === 'tasks' && segments.length === 3 && method === 'POST') {
      const data = taskCreateSchema.parse(input); const taskRef = ref.collection('tasks').doc(data.id);
      const existing = await tx.get(taskRef);
      if (existing.exists) { assert(existing.data()?.createdBy === uid, 409, 'Task ID already exists.'); return { id: data.id }; }
      assert(board.taskCount < LIMITS.tasks, 422, `A board can hold up to ${LIMITS.tasks} tasks.`); taskTarget(board, data, user);
      const tasks = await tx.get(ref.collection('tasks').where('columnId', '==', data.columnId));
      const rank = Math.max(0, ...tasks.docs.map(t => t.data().rank)) + 1024;
      tx.create(taskRef, { ...data, rank, createdBy: uid, revision: 0, createdAt: stamp(), updatedAt: stamp() });
      touch(tx, ref, board, { taskCount: board.taskCount + 1 }); return { id: data.id };
    }
    if (segments[2] === 'tasks' && segments.length === 4 && ['PATCH', 'DELETE'].includes(method)) {
      const taskId = idSchema.parse(segments[3]); const taskRef = ref.collection('tasks').doc(taskId); const snap = await tx.get(taskRef); const task = snap.data() as Task;
      assert(task, 404, 'This task has been deleted.');
      if (method === 'DELETE') {
        const data = z.object({ revision: z.number().int() }).parse(input); revision(task.revision, data.revision);
        tx.delete(taskRef); touch(tx, ref, board, { taskCount: Math.max(0, board.taskCount - 1) }); return { ok: true };
      }
      if (typeof input === 'object' && input !== null && 'action' in input) {
        const data = moveSchema.parse(input); revision(task.revision, data.revision); revision(board.revision, data.boardRevision);
        taskTarget(board, { columnId: data.columnId, assigneeId: task.assigneeId }, user);
        const others = await tx.get(ref.collection('tasks').where('columnId', '==', data.columnId));
        const ordered = others.docs.filter(t => t.id !== taskId).sort((a, b) => a.data().rank - b.data().rank || a.id.localeCompare(b.id));
        const index = data.beforeId === null ? ordered.length : ordered.findIndex(t => t.id === data.beforeId);
        assert(index >= 0, 409, 'The destination task changed. Try moving again.');
        const previous = index === 0 ? 0 : ordered[index - 1].data().rank;
        const next = index === ordered.length ? previous + 2048 : ordered[index].data().rank;
        let rank = (previous + next) / 2;
        if (next - previous < 0.0001) {
          ordered.forEach((doc, i) => tx.update(doc.ref, { rank: (i + 1) * 2048, revision: doc.data().revision + 1, updatedAt: stamp() }));
          rank = index * 2048 + 1024;
        }
        tx.update(taskRef, { columnId: data.columnId, rank, revision: task.revision + 1, updatedAt: stamp() });
      } else {
        const data = taskEditSchema.parse(input); revision(task.revision, data.revision); taskTarget(board, data, user);
        let rank = task.rank;
        if (task.columnId !== data.columnId) {
          const others = await tx.get(ref.collection('tasks').where('columnId', '==', data.columnId));
          rank = Math.max(0, ...others.docs.map(t => t.data().rank)) + 1024;
        }
        tx.update(taskRef, { ...data, rank, revision: task.revision + 1, updatedAt: stamp() });
      }
      touch(tx, ref, board); return { ok: true };
    }
    throw new ApiError(404, 'Endpoint not found.');
  });
}

async function invitations(user: AuthContext, ref: DocumentReference, method: string, input: unknown) {
  assert(user.type !== 'agent', 403, 'Agent tokens cannot manage invitations.');
  const { db } = admin();
  const token = `${ref.id}.${randomBytes(32).toString('base64url')}`;
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref); const board = snap.data() as Board; allowed(board, user, true);
    if (method === 'GET') {
      const invites = await tx.get(ref.collection('invites'));
      return { invites: invites.docs.filter(doc => doc.data().state === 'pending' && doc.data().expiresAt > Date.now()).map(doc => ({ id: doc.id, email: doc.data().email, state: doc.data().state, expiresAt: doc.data().expiresAt })) };
    }
    if (method === 'DELETE') {
      const data = z.object({ id: idSchema }).parse(input); const invite = ref.collection('invites').doc(data.id); const existing = await tx.get(invite);
      assert(existing.exists, 404, 'Invitation not found.'); tx.update(invite, { state: 'revoked' }); touch(tx, ref, board); return { ok: true };
    }
    assert(method === 'POST', 405, 'Method not allowed.');
    const { email } = z.object({ email: z.string().trim().email().max(254).transform(v => v.toLowerCase()) }).parse(input);
    assert(email !== user.email?.toLowerCase(), 422, 'You already own this board.');
    const existing = await tx.get(ref.collection('invites')); const now = Date.now();
    const active = existing.docs.filter(doc => doc.data().state === 'pending' && doc.data().expiresAt > now && doc.data().email !== email);
    assert(active.length < LIMITS.invites, 422, 'This board has too many pending invitations.');
    assert(board.memberIds.length < LIMITS.members, 422, 'This board has reached its member limit.');
    // Prune expired and replaced links while keeping accepted links for safe retry semantics.
    for (const doc of existing.docs) if (doc.data().state !== 'accepted' && (doc.data().email === email || doc.data().expiresAt <= now || doc.data().state === 'revoked')) tx.delete(doc.ref);
    tx.create(ref.collection('invites').doc(hash(token)), { email, state: 'pending', expiresAt: now + 7 * 86400000, createdAt: stamp(), createdBy: user.uid });
    touch(tx, ref, board); return { token };
  });
}

async function acceptInvite(user: AuthContext, input: unknown) {
  assert(user.type === 'user', 403, 'Only human user sessions can accept invitations.');
  const { token } = z.object({ token: z.string().max(256).regex(/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]{43}$/) }).parse(input);
  const { db } = admin(); const ref = db.collection('boards').doc(token.split('.')[0]); const inviteRef = ref.collection('invites').doc(hash(token));
  return db.runTransaction(async tx => {
    const [snap, inviteSnap] = await Promise.all([tx.get(ref), tx.get(inviteRef)]); const board = snap.data() as Board; const invite = inviteSnap.data();
    assert(board && !board.deleting && invite, 404, 'This invitation is unavailable.');
    assert(user.email_verified && invite.email === user.email?.toLowerCase(), 403, 'Sign in with the email this invitation was created for.');
    if (invite.state === 'accepted' && invite.acceptedBy === user.uid && board.memberIds.includes(user.uid)) return { boardId: ref.id };
    assert(invite.state === 'pending' && invite.expiresAt > Date.now(), 410, 'This invitation expired or was revoked. Ask the owner for a new link.');
    assert(board.memberIds.includes(user.uid) || board.memberIds.length < LIMITS.members, 422, 'This board has reached its member limit.');
    tx.update(inviteRef, { state: 'accepted', acceptedBy: user.uid, acceptedAt: stamp() });
    if (!board.memberIds.includes(user.uid)) {
      tx.create(ref.collection('members').doc(user.uid), { ...profile(user), role: 'member' });
      touch(tx, ref, board, { memberIds: [...board.memberIds, user.uid] });
    }
    return { boardId: ref.id };
  });
}

async function deleteBoard(uid: string, ref: DocumentReference) {
  const { db } = admin();
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref); const board = snap.data() as Board;
    if (!board) return;
    assert(board.ownerId === uid, 404, 'Board not found.');
    if (board.deleting) return;
    const userRef = db.collection('users').doc(uid); const user = await tx.get(userRef);
    tx.update(ref, { deleting: true, memberIds: [], updatedAt: stamp() });
    tx.set(userRef, { ownedBoards: Math.max(0, (user.data()?.ownedBoards || 1) - 1) }, { merge: true });
  });
  // Keep the tombstone until all children have been removed so this operation can be retried.
  for (const collection of ['tasks', 'members', 'invites']) {
    for (;;) {
      const page = await ref.collection(collection).limit(200).get(); if (page.empty) break;
      const batch = db.batch(); page.docs.forEach(doc => batch.delete(doc.ref)); await batch.commit();
    }
  }
  await ref.delete(); return { ok: true };
}
