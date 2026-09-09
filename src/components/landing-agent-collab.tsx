'use client';

import React, { useState, useEffect } from 'react';
import {
  Bot,
  GitBranch,
  ShieldCheck,
  Terminal,
  CheckCheck,
  Check,
  Lock,
  ExternalLink,
} from 'lucide-react';

interface StageData {
  id: string;
  stepNumber: string;
  label: string;
  badge: string;
  heading: string;
  description: string;
  features: string[];
  cardColumn: string;
  cardStatusBadge: {
    type: 'pool' | 'active' | 'review' | 'done';
    label: string;
  };
  cardBranch?: string;
  cardDone?: boolean;
  terminalLogs: Array<{ type: 'cmd' | 'info' | 'success' | 'agent'; text: string }>;
}

const STAGES: StageData[] = [
  {
    id: 'claim',
    stepNumber: '01',
    label: 'Assign & Claim',
    badge: 'MCP Protocol',
    heading: 'Instant connection over Model Context Protocol.',
    description:
      'Assign tasks to the Agent Pool or a specific bot. Coding assistants like Claude Code and Cursor connect via MCP stdio to acquire atomic, transactional leases.',
    features: [
      'Transactional 90s leases prevent duplicate execution',
      'Crash recovery automatically re-queues stale or timed-out runs',
      'Scoped tokens isolate agent access to assigned boards only',
    ],
    cardColumn: 'To do',
    cardStatusBadge: { type: 'pool', label: '🤖 Agent Pool' },
    terminalLogs: [
      { type: 'cmd', text: 'claude mcp add taskboard npx -y @taskboard/mcp-server' },
      { type: 'info', text: 'Connected over stdio • 6 tools exposed' },
      { type: 'agent', text: 'taskboard_claim_task(#104) → lease acquired (attempt #1)' },
      { type: 'success', text: 'Task claimed from Agent Pool. Starting execution.' },
    ],
  },
  {
    id: 'execute',
    stepNumber: '02',
    label: 'Isolated Sandbox',
    badge: 'Git Worktrees',
    heading: 'Zero pollution in your local working directory.',
    description:
      'Every run executes inside a dedicated Git worktree branch (.taskboard-runs/). Ambient cloud credentials are automatically sanitized before code executes.',
    features: [
      'Isolated branch: agent/{taskId}/attempt-{attempt}',
      'Environment sanitization purges ambient cloud & API keys',
      'Human question escalation pauses runs if blocked',
    ],
    cardColumn: 'In progress',
    cardStatusBadge: { type: 'active', label: 'Bot Working' },
    cardBranch: 'agent/task-104/attempt-1',
    terminalLogs: [
      { type: 'cmd', text: 'git worktree add .taskboard-runs/task-104-1 -b agent/task-104/attempt-1' },
      { type: 'info', text: 'Sanitizing environment: 6 ambient cloud credentials stripped' },
      { type: 'agent', text: 'vitest run tests/lease.test.ts --reporter=tap' },
      { type: 'success', text: '✔ 14 tests passing (0 failures, exitCode: 0)' },
    ],
  },
  {
    id: 'verify',
    stepNumber: '03',
    label: 'Verify & Complete',
    badge: 'Strict Review Gate',
    heading: 'Objective evidence required before completion.',
    description:
      'Agent tokens are forbidden from marking tasks Done. Agents submit structured verification reports with test output. Human signoff or VCS merge triggers the celebratory strike-through.',
    features: [
      'Verification test gate: exitCode === 0 strictly enforced',
      'Structured review report captures commit hashes and diff stats',
      'Automated VCS merge webhook strikes card Done on PR merge',
    ],
    cardColumn: 'In review',
    cardStatusBadge: { type: 'review', label: 'Review Ready' },
    cardBranch: 'agent/task-104/attempt-1',
    cardDone: true,
    terminalLogs: [
      { type: 'agent', text: 'taskboard_submit_for_review(summary, diffStats, verification)' },
      { type: 'info', text: 'Review report assembled: +48 -6 lines across 2 files' },
      { type: 'cmd', text: 'gh pr merge 42 --squash' },
      { type: 'success', text: 'Webhook verified: PR #42 merged → Task #104 marked Done ✨' },
    ],
  },
];

export function LandingAgentCollab() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Gentle auto-advance every 6s unless paused by user interaction
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % STAGES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [isPaused]);

  const activeStage = STAGES[activeIdx];

  const handleStageSelect = (idx: number) => {
    setActiveIdx(idx);
    setIsPaused(true);
  };

  return (
    <section className="agent-collab-section" aria-label="AI Coding Agent Collaboration">
      <div className="bento-header">
        <span className="eyebrow">
          <span className="tiny-square" /> AUTONOMOUS CODING AGENTS
        </span>
        <h2>Humans and AI agents on the same board.</h2>
        <p>
          Pair program with Claude Code, Cursor, or OpenCode via Model Context Protocol.
          Automated leases, isolated Git worktrees, and objective verification gates keep your board in sync.
        </p>
      </div>

      <div className="agent-collab-card">
        {/* Top Workflow Stage Navigation Tabs */}
        <div className="agent-stage-tabs" role="tablist" aria-label="Agent collaboration workflow stages">
          {STAGES.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={idx === activeIdx}
              className={`agent-stage-tab ${idx === activeIdx ? 'active' : ''}`}
              onClick={() => handleStageSelect(idx)}
            >
              <span className="stage-num">{s.stepNumber}</span>
              <span className="stage-title">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Main Split Body: Explanations on Left, Live Interactive Widget on Right */}
        <div className="agent-collab-body">
          {/* Left Column: Context & Guarantees */}
          <div className="agent-collab-left">
            <div className="agent-collab-meta-row">
              <span className="agent-tech-badge">
                <Bot size={13} /> {activeStage.badge}
              </span>
              <span className="agent-guardrail-pill">
                <Lock size={11} /> Safe by default
              </span>
            </div>

            <h3 className="agent-stage-heading">{activeStage.heading}</h3>
            <p className="agent-stage-desc">{activeStage.description}</p>

            <ul className="agent-feature-list">
              {activeStage.features.map((feat, i) => (
                <li key={i} className="agent-feature-item">
                  <div className="feature-check-box">
                    <Check size={12} />
                  </div>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right Column: Live Simulated Card + Terminal Stream */}
          <div className="agent-collab-right">
            {/* Simulated Mini Kanban Preview Bar */}
            <div className="agent-preview-canvas">
              <div className="preview-canvas-header">
                <div className="preview-canvas-col-indicator">
                  <span className="preview-canvas-dot" />
                  <span>Column: <strong>{activeStage.cardColumn}</strong></span>
                </div>
                {activeStage.cardBranch && (
                  <span className="preview-canvas-branch">
                    <GitBranch size={11} /> {activeStage.cardBranch}
                  </span>
                )}
              </div>

              {/* Simulated Task Card */}
              <div
                className={`agent-live-card ${activeStage.cardDone ? 'card-completed' : ''}`}
                key={activeStage.id}
              >
                <div className="live-card-top">
                  <span className="live-card-title">
                    {activeStage.cardDone && (
                      <CheckCheck size={14} className="live-card-check" />
                    )}
                    Implement transactional lease recovery
                  </span>
                  <span className="priority priority-high">high</span>
                </div>
                <p className="live-card-desc">
                  Ensure stale agent leases release after 90s timeout.
                </p>

                <div className="live-card-footer">
                  {/* Active Badge */}
                  {activeStage.cardStatusBadge.type === 'pool' && (
                    <span className="agent-pool-badge">
                      🤖 Agent Pool
                    </span>
                  )}
                  {activeStage.cardStatusBadge.type === 'active' && (
                    <span className="agent-status-badge active">
                      <span className="live-dot" style={{ width: 6, height: 6 }} /> Bot Working
                    </span>
                  )}
                  {activeStage.cardStatusBadge.type === 'review' && (
                    <span className="agent-status-badge review">
                      <CheckCheck size={11} /> Review Ready
                    </span>
                  )}

                  <span className="live-card-assignee">
                    {activeStage.cardStatusBadge.type === 'pool' ? 'Unassigned' : 'Claude Code'}
                  </span>
                </div>
              </div>

              {/* Monospace Terminal Window */}
              <div className="agent-terminal-window">
                <div className="agent-terminal-titlebar">
                  <div className="terminal-dots">
                    <span className="term-dot close" />
                    <span className="term-dot min" />
                    <span className="term-dot max" />
                  </div>
                  <div className="terminal-title">
                    <Terminal size={11} /> taskboard-agent.stdio
                  </div>
                  <span className="terminal-lang">json-rpc</span>
                </div>

                <div className="agent-terminal-body">
                  {activeStage.terminalLogs.map((log, i) => (
                    <div
                      key={i}
                      className={`term-line term-${log.type}`}
                      style={{ animationDelay: `${i * 0.09}s` }}
                    >
                      {log.type === 'cmd' && <span className="term-prompt">$</span>}
                      {log.type === 'agent' && <span className="term-agent-tag">mcp</span>}
                      <span className="term-text">{log.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
