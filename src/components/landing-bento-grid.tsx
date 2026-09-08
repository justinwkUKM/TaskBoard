'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Mic,
  Users,
  Zap,
  ArrowRight,
  CheckCircle2,
  Filter,
  Check,
  Clock,
  CircleDot,
} from 'lucide-react';

interface BentoTask {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  assignee: string;
  isMine: boolean;
}

const SAMPLE_TASKS: BentoTask[] = [
  { id: 'b1', title: 'Polish 3D hover physics', priority: 'high', assignee: 'W', isMine: true },
  { id: 'b2', title: 'Verify mobile touch responsiveness', priority: 'high', assignee: 'S', isMine: false },
  { id: 'b3', title: 'Write launch announcement copy', priority: 'medium', assignee: 'W', isMine: true },
  { id: 'b4', title: 'Update production DNS records', priority: 'low', assignee: 'A', isMine: false },
];

const PROMPT_PRESETS = [
  {
    label: 'Launch beta next Friday',
    tasks: [
      { title: 'Freeze production code & bump version', priority: 'high' as const, time: '2h' },
      { title: 'Draft release notes & changelog', priority: 'medium' as const, time: '1h' },
      { title: 'Invite first batch of 50 waitlist users', priority: 'high' as const, time: '30m' },
    ],
  },
  {
    label: 'Redesign user onboarding flow',
    tasks: [
      { title: 'Map drop-off drop rates in analytics', priority: 'high' as const, time: '1h' },
      { title: 'Sketch 3-step interactive product tour', priority: 'medium' as const, time: '3h' },
      { title: 'A/B test social login vs email magic link', priority: 'medium' as const, time: '2h' },
    ],
  },
  {
    label: 'Optimize database queries',
    tasks: [
      { title: 'Add compound indexes for user board lookups', priority: 'high' as const, time: '45m' },
      { title: 'Audit Firestore snapshot listener leaks', priority: 'high' as const, time: '1.5h' },
      { title: 'Benchmark drag-and-drop latency', priority: 'low' as const, time: '1h' },
    ],
  },
];

const ACTIVITY_STREAM = [
  { user: 'Sarah', action: 'moved', task: 'Design review', to: 'In progress', time: 'Just now' },
  { user: 'Alex', action: 'completed', task: 'Stripe webhook handler', to: 'Done', time: '2m ago' },
  { user: 'Waqas', action: 'added', task: 'Mobile viewport testing', to: 'To do', time: '5m ago' },
];

export function LandingBentoGrid() {
  // Bento 1: AI Prompt Breakdown state
  const [selectedPromptIdx, setSelectedPromptIdx] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Bento 2: Multiplayer activity stream index
  const [activityIdx, setActivityIdx] = useState(0);

  // Bento 3: Filter state
  const [activeFilter, setActiveFilter] = useState<'all' | 'high' | 'mine'>('all');

  // Loop activity stream every 4s
  useEffect(() => {
    const timer = setInterval(() => {
      setActivityIdx((prev) => (prev + 1) % ACTIVITY_STREAM.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleSelectPrompt = (index: number) => {
    if (index === selectedPromptIdx) return;
    setIsGenerating(true);
    setSelectedPromptIdx(index);
    setTimeout(() => setIsGenerating(false), 350);
  };

  const filteredTasks = SAMPLE_TASKS.filter((task) => {
    if (activeFilter === 'high') return task.priority === 'high';
    if (activeFilter === 'mine') return task.isMine;
    return true;
  });

  const activePrompt = PROMPT_PRESETS[selectedPromptIdx];
  const currentActivity = ACTIVITY_STREAM[activityIdx];

  return (
    <section className="bento-container" aria-label="TaskBoard capabilities">
      <div className="bento-header">
        <span className="eyebrow">
          <span className="tiny-square" /> BUILT FOR CLARITY
        </span>
        <h2>Everything you need. Nothing you don’t.</h2>
        <p>A tactile, high-speed workspace designed to keep you and your team in a state of flow.</p>
      </div>

      <div className="bento-grid">
        {/* BENTO CARD 1: AI Voice & Breakdown Showcase (Span 2 columns on desktop) */}
        <div className="bento-card bento-card-ai">
          <div className="bento-card-meta">
            <div className="bento-badge">
              <Sparkles size={14} className="bento-badge-icon" />
              <span>AI Task Helper</span>
            </div>
            <div className="bento-voice-pill">
              <Mic size={12} />
              <span>Voice ready</span>
            </div>
          </div>

          <div className="bento-card-header">
            <h3>Break down big ambitions in seconds.</h3>
            <p>
              Type or speak any messy goal. TaskBoard organizes it into structured, executable steps with priority and time estimates.
            </p>
          </div>

          {/* Interactive prompt switcher */}
          <div className="bento-prompt-selector" role="tablist" aria-label="Sample AI goals">
            {PROMPT_PRESETS.map((preset, idx) => (
              <button
                key={preset.label}
                type="button"
                role="tab"
                aria-selected={idx === selectedPromptIdx}
                className={`bento-prompt-pill ${idx === selectedPromptIdx ? 'active' : ''}`}
                onClick={() => handleSelectPrompt(idx)}
              >
                <span>&ldquo;{preset.label}&rdquo;</span>
              </button>
            ))}
          </div>

          {/* Generated breakdown cards preview */}
          <div className={`bento-ai-preview ${isGenerating ? 'generating' : ''}`}>
            <div className="bento-ai-preview-header">
              <span className="ai-status">
                <span className="tiny-square" /> Generated breakdown ({activePrompt.tasks.length} tasks)
              </span>
              <span className="ai-speed">Instant • 0.3s</span>
            </div>

            <div className="bento-ai-tasks">
              {activePrompt.tasks.map((task, i) => (
                <div key={task.title} className="bento-ai-task-row" style={{ animationDelay: `${i * 0.08}s` }}>
                  <div className="task-check-circle">
                    <Check size={11} />
                  </div>
                  <span className="task-name">{task.title}</span>
                  <div className="task-meta-right">
                    <span className="task-estimate">
                      <Clock size={11} />
                      <span>{task.time}</span>
                    </span>
                    <span className={`priority priority-${task.priority}`}>
                      {task.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BENTO CARD 2: Real-time Multi-player */}
        <div className="bento-card bento-card-multiplayer">
          <div className="bento-card-meta">
            <div className="bento-badge">
              <Users size={14} className="bento-badge-icon" />
              <span>Real-time presence</span>
            </div>
            <span className="live-dot-pulse-green" />
          </div>

          <div className="bento-card-header">
            <h3>Shared space. Zero merge conflicts.</h3>
            <p>
              See who is viewing, typing, or moving cards in real time with sub-second sync across all devices.
            </p>
          </div>

          <div className="bento-multiplayer-demo">
            {/* Live presence avatar row */}
            <div className="bento-presence-row">
              <div className="bento-avatars">
                <span className="bento-avatar avatar-sarah" title="Sarah (Active)">
                  S
                  <span className="active-dot" />
                </span>
                <span className="bento-avatar avatar-alex" title="Alex (Active)">
                  A
                  <span className="active-dot" />
                </span>
                <span className="bento-avatar avatar-you" title="You (Active)">
                  Y
                  <span className="active-dot" />
                </span>
              </div>
              <span className="bento-presence-count">3 teammates active now</span>
            </div>

            {/* Live activity card snippet */}
            <div className="bento-activity-box">
              <div className="activity-live-indicator">
                <span className="live-dot" />
                <span className="activity-label">LIVE ACTIVITY</span>
              </div>
              <div className="activity-item" key={currentActivity.task}>
                <span className="activity-user">{currentActivity.user}</span>
                <span className="activity-action">{currentActivity.action}</span>
                <strong className="activity-task">&ldquo;{currentActivity.task}&rdquo;</strong>
                <span className="activity-to">→ {currentActivity.to}</span>
                <span className="activity-time">{currentActivity.time}</span>
              </div>
            </div>
          </div>
        </div>

        {/* BENTO CARD 3: Instant Focus & Tactile Filters */}
        <div className="bento-card bento-card-filters">
          <div className="bento-card-meta">
            <div className="bento-badge">
              <Zap size={14} className="bento-badge-icon" />
              <span>Tactile Speed</span>
            </div>
            <span className="bento-speed-tag">&lt; 10ms</span>
          </div>

          <div className="bento-card-header">
            <h3>Filter at the speed of thought.</h3>
            <p>
              Slice your board by priority, assignee, or status instantly with zero page reloads.
            </p>
          </div>

          <div className="bento-filter-demo">
            {/* Filter Buttons */}
            <div className="bento-filter-chips" role="group" aria-label="Interactive filter tabs">
              <button
                type="button"
                className={`bento-filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setActiveFilter('all')}
              >
                All ({SAMPLE_TASKS.length})
              </button>
              <button
                type="button"
                className={`bento-filter-btn ${activeFilter === 'high' ? 'active' : ''}`}
                onClick={() => setActiveFilter('high')}
              >
                High priority (2)
              </button>
              <button
                type="button"
                className={`bento-filter-btn ${activeFilter === 'mine' ? 'active' : ''}`}
                onClick={() => setActiveFilter('mine')}
              >
                Assigned to me (2)
              </button>
            </div>

            {/* Filterable sample tasks */}
            <div className="bento-filter-results">
              {filteredTasks.map((task) => (
                <div key={task.id} className="bento-mini-task">
                  <div className="mini-task-left">
                    <CircleDot size={12} className="mini-task-dot" />
                    <span className="mini-task-title">{task.title}</span>
                  </div>
                  <div className="mini-task-right">
                    <span className={`priority priority-${task.priority}`}>
                      {task.priority}
                    </span>
                    <span className="mini-avatar">{task.assignee}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
