'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  Bot,
  Check,
  CheckCheck,
  Code2,
  Copy,
  ExternalLink,
  HelpCircle,
  KeyRound,
  Link2,
  Plus,
  Terminal,
  Trash2,
  UserMinus
} from 'lucide-react';
import { isMemberActive, type Board, type Column, type Invitation, type Member, type Task } from '@/lib/types';
import { api, errorMessage, useSession } from './providers';
import { Avatar, ErrorNotice, Modal } from './ui';

export function TaskEditor({
  board,
  task,
  columnId,
  members,
  tasks,
  onClose,
  onMove
}: {
  board: Board;
  task?: Task;
  columnId: string;
  members: Member[];
  tasks: Task[];
  onClose: () => void;
  onMove: (task: Task, columnId: string, beforeId: string | null) => Promise<void>;
}) {
  const [id] = useState(() => task?.id || crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const { online } = useSession();

  // Agent question response state
  const [answer, setAnswer] = useState('');
  const [answering, setAnswering] = useState(false);
  const [answerSuccess, setAnswerSuccess] = useState(false);

  const sorted = tasks.filter(t => t.columnId === columnId).sort((a, b) => a.rank - b.rank);
  const index = task ? sorted.findIndex(t => t.id === task.id) : -1;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await api(
        `/boards/${board.id}/tasks${task ? `/${task.id}` : ''}`,
        task ? 'PATCH' : 'POST',
        {
          id,
          title: form.get('title'),
          description: form.get('description'),
          columnId: form.get('columnId'),
          priority: form.get('priority'),
          dueDate: form.get('dueDate') || null,
          assigneeId: form.get('assigneeId') || null,
          ...(task ? { revision: task.revision } : {})
        }
      );
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/boards/${board.id}/tasks/${task!.id}`, 'DELETE', { revision: task!.revision });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitAgentAnswer(e: FormEvent) {
    e.preventDefault();
    if (!task || !answer.trim()) return;
    setAnswering(true);
    setError('');
    try {
      await api(`/boards/${board.id}/tasks/${task.id}/answer`, 'POST', { answer });
      setAnswerSuccess(true);
      setAnswer('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAnswering(false);
    }
  }

  const exec = task?.executionState;
  const report = exec?.reviewReport;

  return (
    <Modal
      title={task ? 'The details.' : 'One small step.'}
      description={task ? 'A little clarity makes all the difference.' : 'What needs to happen next?'}
      onClose={() => { if (!busy) onClose(); }}
      wide
    >
      <form className="form" onSubmit={save}>
        <label>
          Task title
          <input name="title" defaultValue={task?.title} required maxLength={200} placeholder="What are we getting done?" autoFocus />
        </label>
        <label>
          Description <span className="optional">optional</span>
          <textarea name="description" defaultValue={task?.description} maxLength={10000} rows={5} placeholder="Add a little context…" />
        </label>
        <div className="form-grid">
          <label>
            Move to
            <select name="columnId" defaultValue={columnId}>
              {board.columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>
            Priority
            <select name="priority" defaultValue={task?.priority || 'none'}>
              <option value="none">No priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label>
            Due date <span className="optional">optional</span>
            <input name="dueDate" type="date" defaultValue={task?.dueDate || ''} />
          </label>
          <label>
            Assigned to
            <select name="assigneeId" defaultValue={task?.assigneeId || ''}>
              <option value="">Unassigned</option>
              {(members.some(m => m.type === 'agent') || task?.assigneeId === 'agent-pool' || Boolean(task?.executionState)) && (
                <option value="agent-pool">🤖 Agent Pool (Any available bot)</option>
              )}
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.type === 'agent' ? `🤖 ${m.name} (Agent)` : m.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* AI Agent Collaboration Section */}
        {exec && (
          <div className="agent-execution-box">
            <div className="agent-execution-header">
              <div className="agent-execution-title">
                <Bot size={16} />
                <span>AI Coding Agent Status</span>
                <span className={`agent-status-badge ${exec.status}`}>
                  {exec.status === 'active' && <span className="live-dot" style={{ width: 6, height: 6 }} />}
                  {exec.status.replace('_', ' ')}
                </span>
                {exec.attemptCount > 0 && <span className="muted" style={{ fontSize: 11 }}>Attempt #{exec.attemptCount}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {exec.activeBranch && (
                  <span className="branch-pill" title="Git branch checked out for this task">
                    <Terminal size={11} /> {exec.activeBranch}
                  </span>
                )}
                {exec.pullRequestUrl && (
                  <a
                    href={exec.pullRequestUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="button secondary small-button"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                  >
                    <ExternalLink size={12} /> Pull Request
                  </a>
                )}
              </div>
            </div>

            {/* Agent Question (Blocked / Needs Clarification) */}
            {exec.questionText && (
              <div className="agent-question-card">
                <div className="agent-question-title">
                  <HelpCircle size={15} />
                  <span>Agent asked a question:</span>
                </div>
                <p className="agent-question-text">{exec.questionText}</p>
                {exec.questionContext && (
                  <pre className="agent-question-context">{exec.questionContext}</pre>
                )}
                {answerSuccess ? (
                  <div style={{ color: '#15803d', fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Check size={14} /> Answer sent to agent. Execution resuming.
                  </div>
                ) : (
                  <div className="agent-answer-form">
                    <textarea
                      placeholder="Type your clarification or business logic answer..."
                      rows={3}
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                    />
                    <button
                      type="button"
                      className="button small-button"
                      disabled={answering || !answer.trim()}
                      onClick={submitAgentAnswer}
                    >
                      {answering ? 'Submitting…' : 'Submit Answer & Resume Agent'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Structured Review Report */}
            {report && (
              <div className="structured-review-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0 }}>
                    <CheckCheck size={16} style={{ color: '#166534' }} />
                    Automated Verification Report
                  </h4>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {report.baseCommit.slice(0, 7)} → {report.headCommit.slice(0, 7)}
                  </span>
                </div>
                <p style={{ fontSize: 12, margin: '8px 0', lineHeight: 1.6, color: '#374151' }}>
                  {report.summary}
                </p>

                <details className="review-details-accordion">
                  <summary className="review-details-summary">
                    <span>Verification & Diff Details ({report.verification.length} tests, {report.filesChanged?.length || 0} files)</span>
                    <span className="muted" style={{ fontSize: 11 }}>View details ▾</span>
                  </summary>
                  <div style={{ marginTop: 10 }}>
                    <h4>Objective Test Evidence</h4>
                    <div>
                      {report.verification.map((v, i) => (
                        <div className="verification-item" key={i}>
                          <div className="verification-header">
                            <span>{v.command}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span className={`exit-badge ${v.exitCode === 0 ? 'pass' : 'fail'}`}>
                                {v.exitCode === 0 ? 'Pass (Exit 0)' : `Fail (Exit ${v.exitCode})`}
                              </span>
                              <span className="muted">{v.durationMs}ms</span>
                            </span>
                          </div>
                          {v.outputSnippet && (
                            <details style={{ marginTop: 6, fontSize: 11, cursor: 'pointer' }}>
                              <summary className="muted">Command Output Snippet</summary>
                              <pre className="verification-output">{v.outputSnippet}</pre>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>

                    {report.criteriaChecklist && report.criteriaChecklist.length > 0 && (
                      <>
                        <h4>Acceptance Criteria Checklist</h4>
                        <div>
                          {report.criteriaChecklist.map((c, i) => (
                            <div className="criteria-item" key={i}>
                              {c.satisfied ? (
                                <Check size={14} style={{ color: '#166534', flexShrink: 0, marginTop: 2 }} />
                              ) : (
                                <span style={{ color: '#b91c1c', fontWeight: 700, flexShrink: 0 }}>✕</span>
                              )}
                              <div>
                                <strong>{c.criterion}</strong>
                                {c.explanation && <p className="muted" style={{ margin: '2px 0 0', fontSize: 11 }}>{c.explanation}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {report.filesChanged && report.filesChanged.length > 0 && (
                      <>
                        <h4>Files Changed ({report.filesChanged.length})</h4>
                        <div>
                          {report.filesChanged.map((f, i) => (
                            <div className="file-changed-row" key={i}>
                              <span>{f.path}</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span className={`file-change-badge ${f.changeType}`}>{f.changeType}</span>
                                <span className="muted" style={{ fontSize: 10 }}>+{f.insertions} -{f.deletions}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </details>
              </div>
            )}
          </div>
        )}

        {task && (
          <div className="order-controls">
            <span>Position in column</span>
            <button
              type="button"
              className="button secondary small-button"
              disabled={busy || !online || index <= 0}
              onClick={async () => {
                setBusy(true);
                await onMove(task, columnId, sorted[index - 1].id);
                onClose();
              }}
            >
              <ArrowUp size={14} /> Move up
            </button>
            <button
              type="button"
              className="button secondary small-button"
              disabled={busy || !online || index < 0 || index >= sorted.length - 1}
              onClick={async () => {
                setBusy(true);
                await onMove(task, columnId, sorted[index + 2]?.id || null);
                onClose();
              }}
            >
              <ArrowDown size={14} /> Move down
            </button>
          </div>
        )}
        <ErrorNotice message={error} />
        {deleting ? (
          <div className="confirm-inline">
            <p>Delete this task? This cannot be undone.</p>
            <button className="button danger" type="button" disabled={busy || !online} onClick={remove}>
              Yes, delete task
            </button>
            <button className="text-button" type="button" onClick={() => setDeleting(false)}>
              Keep task
            </button>
          </div>
        ) : (
          <div className="dialog-actions">
            {task && (
              <button
                type="button"
                className="icon-button danger-text push-left"
                aria-label="Delete task"
                disabled={busy || !online}
                onClick={() => setDeleting(true)}
              >
                <Trash2 size={18} />
              </button>
            )}
            <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
              Cancel
            </button>
            <button className="button" disabled={busy || !online}>
              {busy ? 'Saving…' : task ? 'Save changes' : 'Add task'}
              <Check size={16} />
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}

export function ColumnEditor({
  board,
  column,
  tasks,
  onClose
}: {
  board: Board;
  column?: Column;
  tasks: Task[];
  onClose: () => void;
}) {
  const [id] = useState(() => column?.id || crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const { online } = useSession();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await api(`/boards/${board.id}/columns`, deleting ? 'DELETE' : column ? 'PATCH' : 'POST', {
        action: deleting ? 'delete' : column ? 'rename' : 'create',
        id,
        name: form.get('name'),
        destinationId: form.get('destinationId') || null,
        revision: board.revision
      });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={deleting ? 'Remove this column?' : column ? 'Make it yours.' : 'A new part of the process.'}
      onClose={() => { if (!busy) onClose(); }}
    >
      <form onSubmit={submit} className="form">
        {deleting ? (
          <>
            <p>Tasks will be moved before the column is removed.</p>
            <label>
              Move existing tasks to
              <select name="destinationId" required={tasks.some(t => t.columnId === id)}>
                <option value="">Choose a column</option>
                {board.columns.filter(c => c.id !== id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </>
        ) : (
          <label>
            Column name
            <input name="name" defaultValue={column?.name} required maxLength={100} placeholder="e.g. In review" autoFocus />
          </label>
        )}
        <ErrorNotice message={error} />
        <div className="dialog-actions">
          {column && !deleting && (
            <button
              className="icon-button danger-text push-left"
              type="button"
              disabled={busy || board.columns.length === 1 || !online}
              onClick={() => setDeleting(true)}
              aria-label="Delete column"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button type="button" className="button secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className={`button ${deleting ? 'danger' : ''}`} disabled={busy || !online}>
            {busy ? 'Saving…' : deleting ? 'Remove column' : column ? 'Save changes' : 'Add column'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function BoardSettings({ board, onClose }: { board: Board; onClose: () => void }) {
  const router = useRouter();
  const { online } = useSession();
  const [tab, setTab] = useState<'general' | 'agents'>('general');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Agent tokens state
  const [agentTokens, setAgentTokens] = useState<Array<{ id: string; name: string; tokenPrefix: string; createdAt: number }>>([]);
  const [agentName, setAgentName] = useState('');
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<{ name: string; token: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  useEffect(() => {
    if (tab === 'agents') {
      void api<{ tokens: Array<{ id: string; name: string; tokenPrefix: string; createdAt: number }> }>(
        `/boards/${board.id}/agent-tokens`
      )
        .then(res => setAgentTokens(res.tokens))
        .catch(err => setError(errorMessage(err)));
    }
  }, [board.id, tab]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await api(`/boards/${board.id}`, 'PATCH', {
        name: data.get('name'),
        description: data.get('description'),
        revision: board.revision
      });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function generateToken(e: FormEvent) {
    e.preventDefault();
    if (!agentName.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await api<{ id: string; name: string; token: string; tokenPrefix: string; createdAt: number }>(
        `/boards/${board.id}/agent-tokens`,
        'POST',
        { name: agentName.trim() }
      );
      setNewlyCreatedToken({ name: res.name, token: res.token });
      setAgentName('');
      setAgentTokens(prev => [{ id: res.id, name: res.name, tokenPrefix: res.tokenPrefix, createdAt: res.createdAt }, ...prev]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function revokeToken(tokenId: string) {
    setBusy(true);
    try {
      await api(`/boards/${board.id}/agent-tokens/${tokenId}`, 'DELETE');
      setAgentTokens(prev => prev.filter(t => t.id !== tokenId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://taskboard.waqasobeidy.com';

  return (
    <Modal
      title="Board settings."
      description="Customize your board and configure AI coding agent collaboration."
      onClose={() => { if (!busy) onClose(); }}
      wide={tab === 'agents'}
    >
      <div className="settings-tab-bar">
        <button
          type="button"
          className={`settings-tab-btn ${tab === 'general' ? 'active' : ''}`}
          onClick={() => setTab('general')}
        >
          General Settings
        </button>
        <button
          type="button"
          className={`settings-tab-btn ${tab === 'agents' ? 'active' : ''}`}
          onClick={() => setTab('agents')}
        >
          <Bot size={14} style={{ display: 'inline', marginRight: 5 }} />
          AI Agents & MCP
        </button>
      </div>

      {tab === 'general' ? (
        <>
          <form className="form" onSubmit={save}>
            <label>Board name<input name="name" required maxLength={100} defaultValue={board.name} /></label>
            <label>Description<textarea name="description" maxLength={1000} rows={3} defaultValue={board.description} /></label>
            <ErrorNotice message={error} />
            <div className="dialog-actions">
              <button className="button secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button>
              <button className="button" disabled={busy || !online}>{busy ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
          <div className="danger-zone">
            {deleting ? (
              <>
                <p>All tasks, invitations, and memberships will be deleted. Type <strong>{board.name}</strong> to confirm.</p>
                <input aria-label="Confirm board name" value={confirm} onChange={e => setConfirm(e.target.value)} />
                <button
                  className="button danger"
                  disabled={confirm !== board.name || busy || !online}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api(`/boards/${board.id}`, 'DELETE');
                      router.replace('/boards');
                    } catch (e) {
                      setError(errorMessage(e));
                      setBusy(false);
                    }
                  }}
                >
                  Permanently delete board
                </button>
              </>
            ) : (
              <button className="text-button danger-text" disabled={busy || !online} onClick={() => setDeleting(true)}>
                <Trash2 size={15} /> Delete this board
              </button>
            )}
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h3 className="subheading" style={{ marginTop: 0 }}>
              <KeyRound size={15} /> Generate Scoped Agent Token
            </h3>
            <p className="field-help" style={{ margin: '0 0 10px' }}>
              Scoped tokens allow local coding agents (Google Antigravity, Claude Code, OpenAI Codex, Cursor) to view tasks, acquire transactional leases, ask questions, and submit review reports via MCP.
            </p>
            <form onSubmit={generateToken} style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="Agent name (e.g. Google Antigravity, Claude Code, OpenAI Codex)"
                value={agentName}
                onChange={e => setAgentName(e.target.value)}
                maxLength={64}
                required
                style={{ flex: 1 }}
              />
              <button className="button" disabled={busy || !agentName.trim()}>
                <Plus size={15} /> Generate Token
              </button>
            </form>
          </div>

          {newlyCreatedToken && (
            <div className="raw-token-box">
              <strong style={{ display: 'block', color: '#166534', fontSize: 13 }}>
                ✓ Token Generated for {newlyCreatedToken.name}!
              </strong>
              <p style={{ fontSize: 11, color: '#15803d', margin: '4px 0' }}>
                Copy this token now. It is encrypted in TaskBoard and cannot be displayed again.
              </p>
              <code className="raw-token-code">{newlyCreatedToken.token}</code>
              <button
                type="button"
                className="button small-button"
                onClick={async () => {
                  await navigator.clipboard.writeText(newlyCreatedToken.token);
                  setCopiedToken(true);
                  setTimeout(() => setCopiedToken(false), 2000);
                }}
              >
                {copiedToken ? <Check size={14} /> : <Copy size={14} />}
                {copiedToken ? 'Copied Token!' : 'Copy Token'}
              </button>
            </div>
          )}

          <div>
            <h3 className="subheading">Active Agent Tokens ({agentTokens.length})</h3>
            {agentTokens.length === 0 ? (
              <p className="muted" style={{ fontSize: 12 }}>No active agent tokens yet. Generate one above to connect your coding assistant.</p>
            ) : (
              agentTokens.map(t => (
                <div className="token-card" key={t.id}>
                  <div>
                    <strong>{t.name}</strong>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 3 }}>
                      <span className="token-prefix">{t.tokenPrefix}</span>
                      <span className="muted" style={{ fontSize: 10 }}>
                        Created {new Date(t.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-button danger-text"
                    disabled={busy}
                    onClick={() => revokeToken(t.id)}
                  >
                    Revoke
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mcp-setup-guide">
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Code2 size={16} /> How to Connect Coding Assistants via MCP
            </h3>
            <p style={{ fontSize: 11, color: '#475569', margin: '0 0 8px' }}>
              <strong>Claude Code CLI:</strong>
            </p>
            <pre>
              {`claude mcp add taskboard npx -y @taskboard/mcp-server --env TASKBOARD_API_URL=${appUrl} --env TASKBOARD_AGENT_TOKEN=<YOUR_TOKEN>`}
            </pre>
            <button
              type="button"
              className="button secondary small-button"
              style={{ marginBottom: 14 }}
              onClick={async () => {
                const cmd = `claude mcp add taskboard npx -y @taskboard/mcp-server --env TASKBOARD_API_URL=${appUrl} --env TASKBOARD_AGENT_TOKEN=<YOUR_TOKEN>`;
                await navigator.clipboard.writeText(cmd);
                setCopiedCli(true);
                setTimeout(() => setCopiedCli(false), 2000);
              }}
            >
              {copiedCli ? <Check size={13} /> : <Copy size={13} />}
              {copiedCli ? 'Copied Command!' : 'Copy Claude CLI Command'}
            </button>

            <p style={{ fontSize: 11, color: '#475569', margin: '0 0 8px' }}>
              <strong>Google Antigravity, OpenAI Codex & Cursor (MCP JSON Config):</strong>
            </p>
            <pre>
{JSON.stringify(
  {
    mcpServers: {
      taskboard: {
        command: "npx",
        args: ["-y", "@taskboard/mcp-server"],
        env: {
          TASKBOARD_API_URL: appUrl,
          TASKBOARD_AGENT_TOKEN: "<YOUR_TOKEN>"
        }
      }
    }
  },
  null,
  2
)}
            </pre>
            <button
              type="button"
              className="button secondary small-button"
              onClick={async () => {
                const config = JSON.stringify(
                  {
                    mcpServers: {
                      taskboard: {
                        command: "npx",
                        args: ["-y", "@taskboard/mcp-server"],
                        env: {
                          TASKBOARD_API_URL: appUrl,
                          TASKBOARD_AGENT_TOKEN: "<YOUR_TOKEN>"
                        }
                      }
                    }
                  },
                  null,
                  2
                );
                await navigator.clipboard.writeText(config);
                setCopiedCli(true);
                setTimeout(() => setCopiedCli(false), 2000);
              }}
            >
              {copiedCli ? <Check size={13} /> : <Copy size={13} />}
              {copiedCli ? 'Copied Configuration!' : 'Copy MCP JSON Config'}
            </button>
          </div>

          <ErrorNotice message={error} />
          <div className="dialog-actions">
            <button type="button" className="button" onClick={onClose}>Done</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function Sharing({
  board,
  members,
  now,
  onClose
}: {
  board: Board;
  members: Member[];
  now: number;
  onClose: () => void;
}) {
  const { user, online } = useSession();
  const router = useRouter();
  const owner = board.ownerId === user?.uid;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);

  useEffect(() => {
    if (owner) {
      void api<{ invites: Invitation[] }>(`/boards/${board.id}/invites`)
        .then(r => setInvites(r.invites))
        .catch(e => setError(errorMessage(e)));
    }
  }, [board.id, owner]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = new FormData(form).get('email');
    setBusy(true);
    setError('');
    try {
      const result = await api<{ token: string }>(`/boards/${board.id}/invites`, 'POST', { email });
      setLink(`${window.location.origin}/invite/${result.token}`);
      setCopied(false);
      form.reset();
      setInvites((await api<{ invites: Invitation[] }>(`/boards/${board.id}/invites`)).invites);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(member: Member) {
    setBusy(true);
    try {
      await api(`/boards/${board.id}/members/${member.id}`, 'DELETE');
      if (member.id === user?.uid) router.replace('/boards');
      setRemoving(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Better together."
      description={owner ? 'Invite your people. Make progress together.' : 'The people making things happen.'}
      onClose={() => { if (!busy) onClose(); }}
      wide
    >
      {owner && (
        <form className="form" onSubmit={invite}>
          <label>
            Email address
            <div className="input-action">
              <input type="email" name="email" required maxLength={254} placeholder="person@gmail.com" />
              <button className="button" disabled={busy || !online}><Plus size={17} /> Invite</button>
            </div>
          </label>
          <p className="field-help">You’ll get a link to send. Only this email can accept it, within 7 days.</p>
        </form>
      )}
      {link && (
        <div className="invitation-link">
          <label>
            <Link2 size={16} /> Your invitation link
            <input aria-label="Invitation link" value={link} readOnly onFocus={e => e.target.select()} />
          </label>
          <button
            className="button secondary small-button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                setError('Select and copy the link manually.');
              }
            }}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      )}
      <ErrorNotice message={error} />
      <h3 className="subheading">On this board <span className="count">{members.length}</span></h3>
      <div className="member-list">
        {members.map(member => {
          const active = isMemberActive(member, now);
          return (
            <div className="member-row" key={member.id}>
              <Avatar name={member.name} photoURL={member.photoURL} size={36} active={active} />
              <span className="member-name">
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  {member.name}
                  {member.type === 'agent' && <span className="agent-pool-badge">🤖 Agent</span>}
                  {member.id === user?.uid && <span className="muted"> (you)</span>}
                  <span className={`presence-tag ${active ? 'online' : 'offline'}`}>
                    <span
                      className={active ? 'live-dot' : 'offline-dot'}
                      style={active ? {} : { width: 6, height: 6, borderRadius: '50%', background: '#9ca3af', display: 'inline-block' }}
                    />
                    {active ? 'Active now' : 'Offline'}
                  </span>
                </span>
                <small>{member.role === 'owner' ? 'Board owner' : member.type === 'agent' ? 'AI Coding Assistant' : 'Can manage tasks'}</small>
              </span>
              {member.role !== 'owner' && (owner || member.id === user?.uid) && (
                <button
                  className="icon-button"
                  disabled={busy || !online}
                  aria-label={member.id === user?.uid ? 'Leave board' : `Remove ${member.name}`}
                  onClick={() => setRemoving(member)}
                >
                  <UserMinus size={17} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {removing && (
        <div className="confirm-inline">
          <p>{removing.id === user?.uid ? 'Leave this board?' : `Remove ${removing.name}?`} Their assigned tasks will become unassigned.</p>
          <button className="button danger small-button" disabled={busy || !online} onClick={() => void remove(removing)}>
            Confirm
          </button>
          <button className="text-button" disabled={busy} onClick={() => setRemoving(null)}>
            Cancel
          </button>
        </div>
      )}
      {owner && invites.length > 0 && (
        <>
          <h3 className="subheading">Pending invitations</h3>
          {invites.map(invite => (
            <div className="pending-invite" key={invite.id}>
              <span>{invite.email}<small>Expires {new Date(invite.expiresAt).toLocaleDateString()}</small></span>
              <button
                className="text-button danger-text"
                disabled={busy || !online}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api(`/boards/${board.id}/invites`, 'DELETE', { id: invite.id });
                    setInvites(invites.filter(i => i.id !== invite.id));
                    setLink('');
                  } catch (e) {
                    setError(errorMessage(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Revoke
              </button>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}
