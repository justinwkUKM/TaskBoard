'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  closestCorners,
  pointerWithin,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, ArrowDown, ArrowUp, CalendarDays, Check, GripVertical, Plus, Search, Settings2, Sparkles, Users, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { isMemberActive, type Board, type Column, type Member, type Task } from '@/lib/types';
import { api, errorMessage, useSession } from './providers';
import { Avatar, ErrorNotice, Header, Loading } from './ui';
import { BoardSettings, ColumnEditor, Sharing, TaskEditor } from './board-dialogs';

const dropAnimationConfig = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.35',
      },
    },
  }),
};

function collisionDetection(args: Parameters<typeof closestCorners>[0]) {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return closestCorners(args);
}

export function BoardScreen({ boardId }: { boardId: string }) {
  const { user, loading, online } = useSession(); const router = useRouter();
  const [board, setBoard] = useState<Board | null>(null); const [tasks, setTasks] = useState<Task[]>([]); const [members, setMembers] = useState<Member[]>([]); const [unavailable, setUnavailable] = useState(false); const [error, setError] = useState('');
  const [search, setSearch] = useState(''); const [priority, setPriority] = useState('all'); const [mine, setMine] = useState(false); const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<{ task?: Task; columnId: string } | null>(null); const [settings, setSettings] = useState(false); const [sharing, setSharing] = useState(false); const [columnEditor, setColumnEditor] = useState<Column | 'new' | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const originalTasksRef = useRef<Task[]>([]);

  const filtered = Boolean(search.trim() || priority !== 'all' || mine); const owner = user?.uid === board?.ownerId;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(interval); }, []);
  useEffect(() => {
    if (!user || unavailable || !online) return;
    const ping = () => { if (typeof document !== 'undefined' && document.visibilityState === 'visible') api(`/boards/${boardId}/heartbeat`, 'POST').catch(() => {}); };
    ping();
    const interval = setInterval(ping, 35000);
    const onVisibility = () => { if (document.visibilityState === 'visible') ping(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisibility); };
  }, [user, boardId, unavailable, online]);
  useEffect(() => { if (!loading && !user) router.replace('/'); }, [user, loading, router]);
  useEffect(() => {
    if (!user || !db) return;
    const clear = () => { setUnavailable(true); setBoard(null); setTasks([]); setMembers([]); setEditor(null); setSettings(false); setSharing(false); setColumnEditor(null); };
    const stopBoard = onSnapshot(doc(db, 'boards', boardId), snap => { if (!snap.exists() || snap.data().deleting || !snap.data().memberIds.includes(user.uid)) clear(); else { setBoard({ ...snap.data(), id: snap.id } as Board); setUnavailable(false); } }, clear);
    const stopTasks = onSnapshot(collection(db, 'boards', boardId, 'tasks'), snap => setTasks(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Task)), clear);
    const stopMembers = onSnapshot(collection(db, 'boards', boardId, 'members'), snap => setMembers(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Member)), clear);
    return () => { stopBoard(); stopTasks(); stopMembers(); };
  }, [user, boardId]);

  async function move(task: Task, columnId: string, beforeId: string | null) {
    if (!board || busy) return; setBusy(true); setError('');
    const prior = originalTasksRef.current.length > 0 ? originalTasksRef.current : tasks;
    const others = tasks.filter(t => t.columnId === columnId && t.id !== task.id).sort(sortTasks);
    const index = beforeId ? others.findIndex(t => t.id === beforeId) : others.length;
    const prevRank = index > 0 ? others[index - 1].rank : 0;
    const nextRank = index < others.length ? others[index].rank : prevRank + 2048;
    setTasks(tasks.map(t => t.id === task.id ? { ...t, columnId, rank: (prevRank + nextRank) / 2 } : t));
    try {
      await api(`/boards/${boardId}/tasks/${task.id}`, 'PATCH', { action: 'move', columnId, beforeId, revision: task.revision, boardRevision: board.revision });
    } catch (e) {
      setTasks(prior);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    if (filtered) return;
    const task = tasks.find(t => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
      originalTasksRef.current = tasks;
    }
  }

  function handleDragOver(event: DragOverEvent) {
    if (filtered || !board) return;
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeItem = tasks.find(t => t.id === activeId);
    if (!activeItem) return;

    const overItem = tasks.find(t => t.id === overId);
    const targetColumn = overItem?.columnId || (overId.startsWith('column:') ? overId.replace('column:', '') : null);
    if (!targetColumn || activeItem.columnId === targetColumn) return;

    setTasks(prev => {
      const activeIndex = prev.findIndex(t => t.id === activeId);
      if (activeIndex === -1) return prev;

      const targetColTasks = prev.filter(t => t.columnId === targetColumn && t.id !== activeId).sort(sortTasks);
      let targetRank = 1000;
      if (overItem) {
        const overIndex = targetColTasks.findIndex(t => t.id === overId);
        const prevRank = overIndex > 0 ? targetColTasks[overIndex - 1].rank : 0;
        const nextRank = overIndex >= 0 ? targetColTasks[overIndex].rank : prevRank + 2048;
        targetRank = (prevRank + nextRank) / 2;
      } else {
        const last = targetColTasks[targetColTasks.length - 1];
        targetRank = last ? last.rank + 1024 : 1000;
      }

      const updated = [...prev];
      updated[activeIndex] = { ...updated[activeIndex], columnId: targetColumn, rank: targetRank };
      return updated;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const active = activeTask;
    setActiveTask(null);
    if (!active || filtered || !board) return;

    const { over } = event;
    if (!over) {
      setTasks(originalTasksRef.current);
      return;
    }

    const activeId = String(event.active.id);
    const overId = String(over.id);
    const currentTask = tasks.find(t => t.id === activeId);
    if (!currentTask) {
      setTasks(originalTasksRef.current);
      return;
    }

    const overItem = tasks.find(t => t.id === overId);
    const targetColumn = overItem?.columnId || (overId.startsWith('column:') ? overId.replace('column:', '') : currentTask.columnId);
    const othersInCol = tasks.filter(t => t.columnId === targetColumn && t.id !== activeId).sort(sortTasks);

    let beforeId: string | null = null;
    if (overItem && overItem.columnId === targetColumn) {
      const overIndex = othersInCol.findIndex(t => t.id === overItem.id);
      if (overIndex !== -1) {
        const originalTask = originalTasksRef.current.find(t => t.id === activeId);
        const sameColumnOriginally = originalTask && originalTask.columnId === targetColumn;
        if (sameColumnOriginally && originalTask.rank < overItem.rank) {
          beforeId = othersInCol[overIndex + 1]?.id || null;
        } else {
          beforeId = overItem.id;
        }
      }
    } else {
      beforeId = null;
    }

    const taskToMove = originalTasksRef.current.find(t => t.id === activeId) || currentTask;
    void move(taskToMove, targetColumn, beforeId);
  }

  function handleDragCancel() {
    setActiveTask(null);
    setTasks(originalTasksRef.current);
  }

  async function shiftColumn(column: Column, direction: number) { if (!board) return; const ids = board.columns.map(c => c.id); const from = ids.indexOf(column.id); const to = from + direction; if (to < 0 || to >= ids.length) return; [ids[from], ids[to]] = [ids[to], ids[from]]; setBusy(true); try { await api(`/boards/${boardId}/columns`, 'PATCH', { action: 'reorder', ids, revision: board.revision }); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } }
  const visible = tasks.filter(t => t.title.toLowerCase().includes(search.trim().toLowerCase()) && (priority === 'all' || t.priority === priority) && (!mine || t.assigneeId === user?.uid));
  const activeMembers = members.filter(m => isMemberActive(m, now));

  return (
    <>
      <Header />
      {unavailable ? (
        <main className="empty-state">
          <h1>This board isn’t available.</h1>
          <p>It may have been deleted, or you may no longer have access.</p>
          <Link className="button" href="/boards">Back to your boards</Link>
        </main>
      ) : !board || loading ? (
        <Loading />
      ) : (
        <main className="board-page">
          <Link className="back-link" href="/boards"><ArrowLeft size={15} /> All boards</Link>
          <div className="board-heading">
            <div>
              <span className="eyebrow">A LITTLE FOCUS GOES A LONG WAY</span>
              <h1>{board.name}</h1>
              {board.description && <p>{board.description}</p>}
            </div>
            <div className="board-heading-actions">
              {activeMembers.length > 0 && (
                <span className="active-pill" title={`${activeMembers.map(m => m.name).join(', ')} online now`}>
                  <span className="live-dot" /> {activeMembers.length} online
                </span>
              )}
              <div className="avatar-stack" aria-label={`${members.length} board members`}>
                {members.slice(0, 5).map(m => (
                  <Avatar key={m.id} name={m.name} photoURL={m.photoURL} size={34} active={isMemberActive(m, now)} />
                ))}
                {members.length > 5 && <span className="avatar-more" title={`${members.length - 5} more members`}>+{members.length - 5}</span>}
              </div>
              <Link className="button secondary" href={`/assistant?boardId=${board.id}`} title="Generate tasks with AI">
                <Sparkles size={16} /> AI Helper
              </Link>
              <button className="button secondary" onClick={() => setSharing(true)}>
                <Users size={16} />{owner ? 'Share board' : 'People'}
              </button>
              {owner && (
                <button className="icon-button bordered" onClick={() => setSettings(true)} aria-label="Board settings">
                  <Settings2 size={18} />
                </button>
              )}
            </div>
          </div>
          <div className="board-toolbar">
            <div className="search-field">
              <Search size={16} />
              <input aria-label="Search tasks" placeholder="Find a task…" value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button className="icon-button" aria-label="Clear search" onClick={() => setSearch('')}><X size={14} /></button>}
            </div>
            <select aria-label="Filter priority" value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="all">All priorities</option>
              <option value="high">High priority</option>
              <option value="medium">Medium priority</option>
              <option value="low">Low priority</option>
              <option value="none">No priority</option>
            </select>
            <button className={`filter-button ${mine ? 'selected' : ''}`} aria-pressed={mine} onClick={() => setMine(!mine)}>
              {mine && <Check size={14} />}Assigned to me
            </button>
            {filtered && (
              <button className="text-button" onClick={() => { setSearch(''); setPriority('all'); setMine(false); }}>
                Clear filters
              </button>
            )}
            <span className="board-status" role="status">
              <span className={busy ? 'saving-dot' : 'live-dot'} />{busy ? 'Saving…' : online ? 'All changes saved' : 'Offline'}
            </span>
          </div>
          <ErrorNotice message={error} />
          {filtered && <p className="filter-note">Showing {visible.length} of {tasks.length} tasks. Clear filters to drag and reorder.</p>}
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="kanban">
              {board.columns.map((column, i) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  index={i}
                  count={board.columns.length}
                  tasks={visible.filter(t => t.columnId === column.id).sort(sortTasks)}
                  members={members}
                  owner={owner}
                  disabled={busy || !online}
                  dragDisabled={busy || !online || filtered}
                  now={now}
                  onAdd={() => setEditor({ columnId: column.id })}
                  onEdit={task => setEditor({ task, columnId: task.columnId })}
                  onColumnEdit={() => setColumnEditor(column)}
                  onShift={direction => void shiftColumn(column, direction)}
                />
              ))}
              {owner && (
                <button className="add-column" disabled={!online || busy} onClick={() => setColumnEditor('new')}>
                  <Plus size={17} /> Add column
                </button>
              )}
            </div>
            <DragOverlay dropAnimation={dropAnimationConfig}>
              {activeTask ? (
                <TaskCardView
                  task={activeTask}
                  assignee={members.find(m => m.id === activeTask.assigneeId)}
                  now={now}
                  isOverlay
                />
              ) : null}
            </DragOverlay>
          </DndContext>
          <div className="board-bottom">
            <span>{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} · {board.columns.length} columns</span>
            <span>Small steps. Real progress.</span>
          </div>
        </main>
      )}
      {board && editor && (
        <TaskEditor
          board={board}
          task={editor.task}
          columnId={editor.columnId}
          members={members}
          tasks={tasks}
          onClose={() => setEditor(null)}
          onMove={move}
        />
      )}
      {board && settings && <BoardSettings board={board} onClose={() => setSettings(false)} />}
      {board && sharing && <Sharing board={board} members={members} now={now} onClose={() => setSharing(false)} />}
      {board && columnEditor && (
        <ColumnEditor
          board={board}
          column={columnEditor === 'new' ? undefined : columnEditor}
          tasks={tasks}
          onClose={() => setColumnEditor(null)}
        />
      )}
    </>
  );
}

function sortTasks(a: Task, b: Task) { return a.rank - b.rank || a.id.localeCompare(b.id); }

function KanbanColumn({
  column,
  index,
  count,
  tasks,
  members,
  owner,
  disabled,
  dragDisabled,
  now,
  onAdd,
  onEdit,
  onColumnEdit,
  onShift,
}: {
  column: Column;
  index: number;
  count: number;
  tasks: Task[];
  members: Member[];
  owner: boolean;
  disabled: boolean;
  dragDisabled: boolean;
  now: number;
  onAdd: () => void;
  onEdit: (task: Task) => void;
  onColumnEdit: () => void;
  onShift: (direction: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${column.id}`, disabled: dragDisabled });
  return (
    <section className={`kanban-column ${isOver ? 'column-over' : ''}`} ref={setNodeRef} aria-label={`${column.name} column`}>
      <div className="kanban-column-header">
        <h2>
          <span className={`status-dot status-${index === count - 1 ? 2 : index === 0 ? 0 : 1}`} />
          {column.name}
          <span className="count">{tasks.length}</span>
        </h2>
        {owner && (
          <div className="column-controls">
            <button className="icon-button" aria-label={`Move ${column.name} column left`} disabled={disabled || index === 0} onClick={() => onShift(-1)}>
              <ArrowUp size={13} className="rotate-left" />
            </button>
            <button className="icon-button" aria-label={`Move ${column.name} column right`} disabled={disabled || index === count - 1} onClick={() => onShift(1)}>
              <ArrowDown size={13} className="rotate-left" />
            </button>
            <button className="icon-button" disabled={disabled} aria-label={`Edit ${column.name} column`} onClick={onColumnEdit}>
              <Settings2 size={14} />
            </button>
          </div>
        )}
      </div>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="column-cards">
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              assignee={members.find(m => m.id === task.assigneeId)}
              now={now}
              disabled={dragDisabled}
              onEdit={() => onEdit(task)}
            />
          ))}
        </div>
      </SortableContext>
      <button className="add-task" disabled={disabled} onClick={onAdd}>
        <Plus size={16} /> Add task
      </button>
      {!tasks.length && <div className="column-empty">A little room for what’s next.</div>}
    </section>
  );
}

function TaskCard({
  task,
  assignee,
  now,
  disabled,
  onEdit,
}: {
  task: Task;
  assignee?: Member;
  now: number;
  disabled: boolean;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled });
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <article
      ref={setNodeRef}
      className={`task-card task-card-${task.priority || 'none'} ${isDragging ? 'dragging' : ''}`}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? undefined : (transition || 'transform 200ms cubic-bezier(0.2, 0, 0, 1)'),
      }}
    >
      <div className="task-card-top">
        <button className="task-open" onClick={onEdit}>{task.title}</button>
        <button className="drag-handle" aria-label={`Drag ${task.title}`} {...attributes} {...listeners} disabled={disabled}>
          <GripVertical size={16} />
        </button>
      </div>
      {task.description && <p className="task-excerpt">{task.description}</p>}
      <div className="task-card-meta">
        {task.priority !== 'none' && <span className={`priority priority-${task.priority}`}>{task.priority}</span>}
        {task.dueDate && (
          <span className={`task-date ${task.dueDate < todayString ? 'overdue' : ''}`} title={task.dueDate}>
            <CalendarDays size={12} />
            {new Date(`${task.dueDate}T12:00:00`).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          </span>
        )}
        {assignee && <Avatar name={assignee.name} photoURL={assignee.photoURL} size={22} active={isMemberActive(assignee, now)} />}
      </div>
    </article>
  );
}

function TaskCardView({
  task,
  assignee,
  now,
  isOverlay = false,
}: {
  task: Task;
  assignee?: Member;
  now: number;
  isOverlay?: boolean;
}) {
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <article className={`task-card task-card-${task.priority || 'none'} ${isOverlay ? 'dragging-overlay' : ''}`}>
      <div className="task-card-top">
        <span className="task-open">{task.title}</span>
        <span className="drag-handle" style={{ cursor: isOverlay ? 'grabbing' : 'grab' }}>
          <GripVertical size={16} />
        </span>
      </div>
      {task.description && <p className="task-excerpt">{task.description}</p>}
      <div className="task-card-meta">
        {task.priority !== 'none' && <span className={`priority priority-${task.priority}`}>{task.priority}</span>}
        {task.dueDate && (
          <span className={`task-date ${task.dueDate < todayString ? 'overdue' : ''}`} title={task.dueDate}>
            <CalendarDays size={12} />
            {new Date(`${task.dueDate}T12:00:00`).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          </span>
        )}
        {assignee && <Avatar name={assignee.name} photoURL={assignee.photoURL} size={22} active={isMemberActive(assignee, now)} />}
      </div>
    </article>
  );
}

