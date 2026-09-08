'use client';

import React, { useState, useRef, useCallback } from 'react';
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
import { Check, CheckCheck, GripVertical, RotateCcw, Sparkles } from 'lucide-react';

export type HeroTask = {
  id: string;
  title: string;
  columnId: 'todo' | 'inprogress' | 'done';
  priority?: 'high' | 'medium';
  avatar: string;
  isFeatured?: boolean;
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

function HeroCard({
  task,
  isOverlay = false,
}: {
  task: HeroTask;
  isOverlay?: boolean;
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

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const isDone = task.columnId === 'done';
  const isInProgress = task.columnId === 'inprogress' && task.isFeatured;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`preview-card preview-card-interactive ${
        isInProgress ? 'featured-card' : ''
      } ${isOverlay ? 'preview-card-overlay' : ''}`}
    >
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
}: {
  col: (typeof COLUMNS)[number];
  tasks: HeroTask[];
  isCelebrate?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: col.id,
    data: { columnId: col.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`preview-column ${isOver ? 'preview-column-over' : ''} ${
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
            <HeroCard key={task.id} task={task} />
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
  const [tiltStyle, setTiltStyle] = useState<{
    transform: string;
    mouseX: string;
    mouseY: string;
  }>({
    transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) rotate(-1deg)',
    mouseX: '50%',
    mouseY: '50%',
  });

  const cardRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    })
  );

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
    const current = tasks.find((t) => t.id === event.active.id);
    if (current) setActiveTask(current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
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
    setTasks(INITIAL_TASKS);
    setCelebrate(false);
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
              <span className="mini-avatar avatar-sarah" title="Sarah (editing)">S</span>
              <span className="mini-avatar avatar-alex" title="Alex (viewing)">A</span>
              <span className="mini-avatar avatar-you" title="You">Y</span>
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
