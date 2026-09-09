'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
  useDroppable,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckCheck, GripVertical, RotateCcw, Sparkles } from 'lucide-react';

export type HeroTask = {
  id: string;
  title: string;
  columnId: 'todo' | 'inprogress' | 'done';
  priority?: 'high' | 'medium';
  avatar: string;
  isFeatured?: boolean;
};

const COLLABORATORS = [
  { name: 'Sarah', avatar: 'S' },
  { name: 'Alex', avatar: 'A' },
  { name: 'You', avatar: 'Y' },
];

export type AutoMovingCard = {
  taskId: string;
  targetColId: 'todo' | 'inprogress' | 'done';
  delta: { x: number; y: number };
  collaborator: (typeof COLLABORATORS)[number];
};

const INITIAL_TASKS: HeroTask[] = [
  {
    id: 'hero-1',
    title: 'The idea that won’t leave your head',
    columnId: 'todo',
    priority: 'high',
    avatar: 'T',
  },
  {
    id: 'hero-2',
    title: 'Make a little room for it',
    columnId: 'todo',
    avatar: 'S',
  },
  {
    id: 'hero-3',
    title: 'Start somewhere',
    columnId: 'inprogress',
    avatar: 'Y',
    isFeatured: true,
  },
  {
    id: 'hero-4',
    title: 'Take the first step',
    columnId: 'done',
    avatar: 'W',
  },
];

const COLUMNS = [
  { id: 'todo' as const, name: 'To do', dotClass: 'status-0' },
  { id: 'inprogress' as const, name: 'In progress', dotClass: 'status-1' },
  { id: 'done' as const, name: 'Done', dotClass: 'status-2' },
];

function getNextAutoMove(
  currentTasks: HeroTask[]
): { task: HeroTask; targetColId: 'todo' | 'inprogress' | 'done' } | null {
  if (!currentTasks.length) return null;

  const todoTasks = currentTasks.filter((t) => t.columnId === 'todo');
  const inProgressTasks = currentTasks.filter((t) => t.columnId === 'inprogress');
  const doneTasks = currentTasks.filter((t) => t.columnId === 'done');

  type MoveCandidate = { task: HeroTask; targetColId: 'todo' | 'inprogress' | 'done'; weight: number };
  const candidates: MoveCandidate[] = [];

  // 1. In-progress to Done
  inProgressTasks.forEach((t) => {
    candidates.push({ task: t, targetColId: 'done', weight: 45 });
    candidates.push({ task: t, targetColId: 'todo', weight: 10 });
  });

  // 2. To-do to In-progress
  todoTasks.forEach((t) => {
    candidates.push({ task: t, targetColId: 'inprogress', weight: 50 });
    candidates.push({ task: t, targetColId: 'done', weight: 15 });
  });

  // 3. Done to To-do (cycle back for perpetual momentum)
  doneTasks.forEach((t) => {
    candidates.push({ task: t, targetColId: 'todo', weight: 40 });
    candidates.push({ task: t, targetColId: 'inprogress', weight: 15 });
  });

  if (!candidates.length) return null;

  const totalWeight = candidates.reduce((acc, c) => acc + c.weight, 0);
  let random = Math.random() * totalWeight;
  for (const c of candidates) {
    if (random < c.weight) return { task: c.task, targetColId: c.targetColId };
    random -= c.weight;
  }
  return candidates[0];
}

function HeroCard({
  task,
  isOverlay = false,
  isFlying = false,
  flightDelta,
  isJustLanded = false,
  collaboratorName,
}: {
  task: HeroTask;
  isOverlay?: boolean;
  isFlying?: boolean;
  flightDelta?: { x: number; y: number };
  isJustLanded?: boolean;
  collaboratorName?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { task },
  });

  const baseStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const flyingStyle: React.CSSProperties =
    isFlying && flightDelta
      ? {
          transform: `translate3d(${flightDelta.x}px, ${flightDelta.y}px, 0) rotate(3deg) scale(1.03)`,
          transition:
            flightDelta.x === 0 && flightDelta.y === 0
              ? 'transform 100ms ease-out, box-shadow 100ms ease-out'
              : 'transform 720ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 300ms ease',
          boxShadow: '0 16px 32px -4px rgba(0,0,0,0.2), 0 6px 14px -2px rgba(0,0,0,0.12)',
          borderColor: '#8fa838',
          zIndex: 100,
          position: 'relative',
          pointerEvents: 'none',
        }
      : {};

  const isDone = task.columnId === 'done';
  const isInProgress = task.columnId === 'inprogress' && task.isFeatured;

  return (
    <div
      id={`hero-card-${task.id}`}
      ref={setNodeRef}
      style={{ ...baseStyle, ...flyingStyle }}
      {...attributes}
      {...listeners}
      className={`preview-card preview-card-interactive ${
        isInProgress ? 'featured-card' : ''
      } ${isOverlay ? 'preview-card-overlay' : ''} ${
        isFlying ? 'is-flying' : ''
      } ${isJustLanded ? 'card-just-landed' : ''}`}
    >
      {isFlying && collaboratorName && (
        <span className="flying-agent-badge">
          <span className="live-dot-pulse" style={{ width: 5, height: 5 }} />
          <span>{collaboratorName}</span>
        </span>
      )}
      {isInProgress && <span className="small-label">ONE THING AT A TIME</span>}
      <span style={{ textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.8 : 1 }}>
        {task.title}
      </span>
      <div className="preview-card-bottom">
        {isDone ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#3f6212', fontWeight: 600 }}>
            <CheckCheck size={15} />
            <span style={{ fontSize: 9 }}>Done</span>
          </span>
        ) : (
          <GripVertical size={14} className="hero-drag-handle" />
        )}
        <span className="mini-avatar">{task.avatar}</span>
      </div>
      {task.priority === 'high' && !isDone && (
        <span className="priority priority-high">High priority</span>
      )}
    </div>
  );
}

function HeroColumn({
  col,
  tasks,
  isCelebrate = false,
  isTargetOfFlight = false,
  movingState,
  justLandedId,
}: {
  col: (typeof COLUMNS)[number];
  tasks: HeroTask[];
  isCelebrate?: boolean;
  isTargetOfFlight?: boolean;
  movingState?: AutoMovingCard | null;
  justLandedId?: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: col.id,
    data: { columnId: col.id },
  });

  return (
    <div
      id={`hero-col-${col.id}`}
      ref={setNodeRef}
      className={`preview-column ${isOver || isTargetOfFlight ? 'preview-column-over' : ''} ${
        isCelebrate && col.id === 'done' ? 'preview-column-celebrate' : ''
      }`}
    >
      <div className="column-title">
        <span className={`status-dot ${col.dotClass}`} />
        <span>{col.name}</span>
        <span className={`count ${isCelebrate && col.id === 'done' ? 'count-bump' : ''}`}>
          {tasks.length}
        </span>
      </div>
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="preview-column-cards">
          {tasks.map((task) => (
            <HeroCard
              key={task.id}
              task={task}
              isFlying={movingState?.taskId === task.id}
              flightDelta={movingState?.taskId === task.id ? movingState.delta : undefined}
              isJustLanded={justLandedId === task.id}
              collaboratorName={
                movingState?.taskId === task.id ? movingState.collaborator.name : undefined
              }
            />
          ))}
          {tasks.length === 0 && (
            <div className="preview-column-empty">Drop card here</div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function LandingHeroBoard() {
  const [tasks, setTasks] = useState<HeroTask[]>(INITIAL_TASKS);
  const [activeTask, setActiveTask] = useState<HeroTask | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [movingState, setMovingState] = useState<AutoMovingCard | null>(null);
  const [justLandedId, setJustLandedId] = useState<string | null>(null);
  const [activityMessage, setActivityMessage] = useState<string | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  const userInteractingRef = useRef<number>(0);
  const autoMoveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [tiltStyle, setTiltStyle] = useState<{
    transform: string;
    mouseX: string;
    mouseY: string;
  }>({
    transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) rotate(-1deg)',
    mouseX: '50%',
    mouseY: '50%',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    })
  );

  const triggerAutoMove = useCallback(() => {
    if (
      !autoPlay ||
      activeTask ||
      movingState ||
      (typeof document !== 'undefined' && document.hidden) ||
      Date.now() - userInteractingRef.current < 3500
    ) {
      return;
    }

    const nextMove = getNextAutoMove(tasksRef.current);
    if (!nextMove) return;

    const { task, targetColId } = nextMove;
    const cardEl = document.getElementById(`hero-card-${task.id}`);
    const colEl = document.getElementById(`hero-col-${targetColId}`);

    let deltaX = 0;
    let deltaY = 0;

    if (cardEl && colEl) {
      const cardRect = cardEl.getBoundingClientRect();
      const cardsContainer = colEl.querySelector('.preview-column-cards') || colEl;
      const containerRect = cardsContainer.getBoundingClientRect();

      deltaX = (containerRect.left + (containerRect.width - cardRect.width) / 2) - cardRect.left;

      const otherCards = Array.from(colEl.querySelectorAll('.preview-card')).filter(
        (el) => el !== cardEl
      );
      let targetY = containerRect.top + 6;
      if (otherCards.length > 0) {
        const lastCard = otherCards[otherCards.length - 1];
        targetY = lastCard.getBoundingClientRect().bottom + 8;
      }
      deltaY = targetY - cardRect.top;
    }

    const collaborator = COLLABORATORS[Math.floor(Math.random() * COLLABORATORS.length)];

    // Phase 1: Lift card
    setMovingState({
      taskId: task.id,
      targetColId,
      delta: { x: 0, y: 0 },
      collaborator,
    });

    // Phase 2: Start gliding towards target column
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMovingState((prev) => (prev ? { ...prev, delta: { x: deltaX, y: deltaY } } : null));
      });
    });

    // Phase 3: Land card after 720ms
    autoMoveTimeoutRef.current = setTimeout(() => {
      const wasAlreadyDone = task.columnId === 'done';

      setTasks((prev) => {
        return prev.map((t) => {
          if (t.id === task.id) {
            return {
              ...t,
              columnId: targetColId,
              isFeatured: targetColId === 'inprogress',
            };
          }
          if (targetColId === 'inprogress') {
            return { ...t, isFeatured: false };
          }
          return t;
        });
      });

      setMovingState(null);
      setJustLandedId(task.id);
      setTimeout(() => setJustLandedId(null), 450);

      const colName = COLUMNS.find((c) => c.id === targetColId)?.name || targetColId;
      setActivityMessage(`${collaborator.name} moved "${task.title}" → ${colName}`);
      setTimeout(() => setActivityMessage(null), 2400);

      if (targetColId === 'done' && !wasAlreadyDone) {
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 2200);
      }
    }, 720);
  }, [autoPlay, activeTask, movingState]);

  const triggerAutoMoveRef = useRef(triggerAutoMove);
  useEffect(() => {
    triggerAutoMoveRef.current = triggerAutoMove;
  }, [triggerAutoMove]);

  useEffect(() => {
    if (!autoPlay) return;

    const initialTimer = setTimeout(() => {
      triggerAutoMoveRef.current();
    }, 2400);

    const interval = setInterval(() => {
      triggerAutoMoveRef.current();
    }, 4200);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      if (autoMoveTimeoutRef.current) clearTimeout(autoMoveTimeoutRef.current);
    };
  }, [autoPlay]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pctX = (x / rect.width) * 100;
    const pctY = (y / rect.height) * 100;

    // Subtle 3D tilt
    const tiltX = -((y - rect.height / 2) / (rect.height / 2)) * 4.5;
    const tiltY = ((x - rect.width / 2) / (rect.width / 2)) * 5.5;

    setTiltStyle({
      transform: `perspective(1000px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) rotate(-1deg) translateY(-2px)`,
      mouseX: `${pctX.toFixed(1)}%`,
      mouseY: `${pctY.toFixed(1)}%`,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTiltStyle({
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) rotate(-1deg) translateY(0px)',
      mouseX: '50%',
      mouseY: '50%',
    });
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    userInteractingRef.current = Date.now();
    if (movingState) {
      if (autoMoveTimeoutRef.current) clearTimeout(autoMoveTimeoutRef.current);
      setMovingState(null);
    }
    const current = tasks.find((t) => t.id === event.active.id);
    if (current) setActiveTask(current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    userInteractingRef.current = Date.now();
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const currentTask = tasks.find((t) => t.id === activeId);
    if (!currentTask) return;

    // Determine target column
    let targetColId: 'todo' | 'inprogress' | 'done' | null = null;
    if (overId === 'todo' || overId === 'inprogress' || overId === 'done') {
      targetColId = overId;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) targetColId = overTask.columnId;
    }

    if (!targetColId) return;

    const wasAlreadyDone = currentTask.columnId === 'done';

    setTasks((prev) => {
      const next = prev.map((t) => {
        if (t.id === activeId) {
          return {
            ...t,
            columnId: targetColId,
            isFeatured: targetColId === 'inprogress',
          };
        }
        if (targetColId === 'inprogress') {
          return { ...t, isFeatured: false };
        }
        return t;
      });
      return next;
    });

    // If moved into 'done' from another column, trigger celebration
    if (targetColId === 'done' && !wasAlreadyDone) {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 2200);
    }
  };

  const resetBoard = () => {
    if (autoMoveTimeoutRef.current) clearTimeout(autoMoveTimeoutRef.current);
    setMovingState(null);
    setTasks(INITIAL_TASKS);
    setCelebrate(false);
    userInteractingRef.current = Date.now();
  };

  const isModified = JSON.stringify(tasks) !== JSON.stringify(INITIAL_TASKS);

  return (
    <div
      className="hero-tilt-perspective hero-stagger-preview"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <section
        ref={cardRef}
        className="hero-preview hero-preview-interactive"
        style={
          {
            transform: tiltStyle.transform,
            '--mouse-x': tiltStyle.mouseX,
            '--mouse-y': tiltStyle.mouseY,
          } as React.CSSProperties
        }
        aria-label="Interactive example task board"
      >
        <div className="hero-specular-sheen" />

        {/* Preview header with simulated multiplayer presence */}
        <div className="preview-header">
          <div className="preview-header-left">
            <span className="tiny-square" />
            <span className="preview-board-title">THE NEXT BIG THING</span>
            <span className="live-presence-badge" title="Live collaborator presence">
              <span className="live-dot-pulse" />
              <span>3 online</span>
            </span>
          </div>

          <div className="preview-header-right">
            <div className="simulated-avatars" title="Collaborators on this board">
              <span
                className={`mini-avatar avatar-sarah ${
                  movingState?.collaborator.name === 'Sarah' ? 'avatar-active-pulse' : ''
                }`}
                title="Sarah (editing)"
              >
                S
              </span>
              <span
                className={`mini-avatar avatar-alex ${
                  movingState?.collaborator.name === 'Alex' ? 'avatar-active-pulse' : ''
                }`}
                title="Alex (viewing)"
              >
                A
              </span>
              <span
                className={`mini-avatar avatar-you ${
                  movingState?.collaborator.name === 'You' ? 'avatar-active-pulse' : ''
                }`}
                title="You"
              >
                Y
              </span>
            </div>
            {isModified && (
              <button
                type="button"
                onClick={resetBoard}
                className="reset-demo-btn"
                title="Reset cards to original state"
              >
                <RotateCcw size={11} />
                <span>Reset</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setAutoPlay((prev) => !prev)}
              className={`auto-play-toggle-btn ${autoPlay ? 'active' : ''}`}
              title={
                autoPlay
                  ? 'Auto-movement active (click to pause)'
                  : 'Auto-movement paused (click to resume)'
              }
            >
              <span className={autoPlay ? 'auto-dot-pulse' : 'auto-dot-paused'} />
              <span>{autoPlay ? 'Live' : 'Paused'}</span>
            </button>
            <span className="pill">Interactive demo</span>
          </div>
        </div>

        {/* Drag and Drop Context */}
        <DndContext
          sensors={sensors}
          collisionDetection={(args) => {
            const pointer = pointerWithin(args);
            return pointer.length > 0 ? pointer : closestCorners(args);
          }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="preview-columns">
            {COLUMNS.map((col) => (
              <HeroColumn
                key={col.id}
                col={col}
                tasks={tasks.filter((t) => t.columnId === col.id)}
                isCelebrate={celebrate}
                isTargetOfFlight={movingState?.targetColId === col.id}
                movingState={movingState}
                justLandedId={justLandedId}
              />
            ))}
          </div>

          <DragOverlay
            dropAnimation={{
              sideEffects: defaultDropAnimationSideEffects({
                styles: {
                  active: {
                    opacity: '0.4',
                  },
                },
              }),
            }}
          >
            {activeTask ? <HeroCard task={activeTask} isOverlay /> : null}
          </DragOverlay>
        </DndContext>

        {/* Preview Footer / Caption */}
        <div className="preview-caption">
          {celebrate ? (
            <span className="celebration-badge">
              <Sparkles size={13} className="sparkle-icon" />
              <span>Task completed! Small steps make big momentum.</span>
            </span>
          ) : activityMessage ? (
            <span className="activity-live-badge">
              <span className="live-dot-pulse" style={{ width: 6, height: 6 }} />
              <span>{activityMessage}</span>
            </span>
          ) : (
            <>
              <span className="live-dot" />
              <span>Try dragging cards between columns — feel the tactile snap.</span>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
