'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { ArrowLeft, ArrowRight, Check, Key, Mic, MicOff, Plus, RefreshCw, Sparkles, Trash2, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import type { Board } from '@/lib/types';
import { api, errorMessage, useSession } from '@/components/providers';
import { ErrorNotice, Footer, Header, Loading } from '@/components/ui';

type ProposedTask = {
  id: string;
  title: string;
  description: string;
  priority: 'none' | 'low' | 'medium' | 'high';
  columnId: string;
  selected: boolean;
  added?: boolean;
};

const PROMPT_TEMPLATES = [
  {
    label: '🚀 Product Launch',
    prompt: 'Prepare our upcoming product launch next week: finalize landing page copy, conduct user testing with 5 customers, set up analytics and conversion tracking, prepare social launch graphics, and draft the product newsletter.'
  },
  {
    label: '🎨 Website Redesign',
    prompt: 'Redesign our portfolio website: audit existing pages, gather typography and color palettes, design high-fidelity desktop and mobile wireframes in Figma, implement responsive navbar and dark mode, and optimize Core Web Vitals.'
  },
  {
    label: '🐛 Sprint Bug Bash',
    prompt: 'Conduct a thorough sprint bug bash: triage user reported tickets, fix mobile navigation layout jump, resolve Google OAuth popup timeout, add form validation to billing page, and write regression unit tests.'
  },
  {
    label: '📅 Weekly Goals',
    prompt: 'Plan this week’s highest-impact priorities: organize backlog tickets, conduct 1-on-1 team check-ins, review customer onboarding funnel metrics, and ship the v1.2 release notes.'
  }
];

export default function AssistantPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AssistantContent />
    </Suspense>
  );
}

function AssistantContent() {
  const { user, loading, online } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialBoardId = searchParams.get('boardId');

  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>(initialBoardId || '');
  const [selectedColOverride, setSelectedColOverride] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try { return localStorage.getItem('taskboard_gemini_key') || ''; } catch {}
    }
    return '';
  });
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [adding, setAdding] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [modelUsed, setModelUsed] = useState<string>('');
  const [tasks, setTasks] = useState<ProposedTask[]>([]);
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Speech Recognition state
  const [recording, setRecording] = useState<boolean>(false);
  const [speechSupported] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return Boolean(
      (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    );
  });
  const [speechInterim, setSpeechInterim] = useState<string>('');
  const recognitionRef = useRef<unknown>(null);

  // Authentication guard
  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [user, loading, router]);

  // Load user boards from Firestore
  useEffect(() => {
    if (!user || !db) return;
    const q = query(
      collection(db, 'boards'),
      where('memberIds', 'array-contains', user.uid),
      where('deleting', '==', false),
      orderBy('updatedAt', 'desc')
    );
    return onSnapshot(
      q,
      snap => {
        const loaded = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Board);
        setBoards(loaded);
        if (!selectedBoardId && loaded.length > 0) {
          const match = initialBoardId && loaded.find(b => b.id === initialBoardId);
          setSelectedBoardId(match ? match.id : loaded[0].id);
        }
      },
      () => setError('Could not load your boards. Please refresh.')
    );
  }, [user, initialBoardId, selectedBoardId]);

  const activeBoard = boards.find(b => b.id === selectedBoardId);
  const defaultColumnId =
    activeBoard && activeBoard.columns.some(c => c.id === selectedColOverride)
      ? selectedColOverride
      : (activeBoard?.columns[0]?.id || '');

  // Speech Recognition initialization
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recog = new (SpeechRecognition as any)();
      recog.continuous = true;
      recog.interimResults = true;
      recog.lang = navigator.language || 'en-US';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recog.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript + ' ';
          } else {
            interim += transcript;
          }
        }
        if (final) {
          setPrompt(prev => (prev ? `${prev.trim()} ${final.trim()}` : final.trim()));
        }
        setSpeechInterim(interim);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recog.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          setError('Microphone access was blocked. Please click the site permissions/lock icon in your browser address bar to allow microphone access on this site, then try again.');
        } else if (event.error !== 'no-speech') {
          setError(`Speech recognition notice: ${event.error}. You can also type your request.`);
        }
        setRecording(false);
        setSpeechInterim('');
      };

      recog.onend = () => {
        setRecording(false);
        setSpeechInterim('');
      };

      recognitionRef.current = recog;
    } catch {
      recognitionRef.current = null;
    }
  }, []);

  async function toggleRecording() {
    setError('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recog = recognitionRef.current as any;
    if (!recog) {
      setError('Voice recognition is not supported on this browser. Please type your request.');
      return;
    }

    if (recording) {
      try {
        recog.stop();
      } catch {}
      setRecording(false);
      setSpeechInterim('');
    } else {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
        } catch {
          setError('Microphone access was blocked. Please click the site settings/lock icon in your browser address bar to allow microphone access.');
          return;
        }
      }

      try {
        recog.start();
        setRecording(true);
      } catch {
        try {
          recog.stop();
          setTimeout(() => {
            recog.start();
            setRecording(true);
          }, 150);
        } catch {
          setError('Could not access microphone. Please check browser permissions.');
          setRecording(false);
        }
      }
    }
  }

  function handleSaveKey(value: string) {
    setApiKey(value);
    try {
      if (value.trim()) localStorage.setItem('taskboard_gemini_key', value.trim());
      else localStorage.removeItem('taskboard_gemini_key');
    } catch {}
  }

  async function generateTasks() {
    if (!prompt.trim()) {
      setError('Please write or speak what you would like to accomplish.');
      return;
    }
    if (!selectedBoardId) {
      setError('Please select a target board.');
      return;
    }

    setGenerating(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await api<{
        summary: string;
        tasks: Array<{
          title: string;
          description: string;
          priority: 'none' | 'low' | 'medium' | 'high';
          suggestedColumn: string;
        }>;
        modelUsed: string;
      }>('/ai/generate', 'POST', {
        prompt: prompt.trim(),
        boardId: selectedBoardId,
        apiKey: apiKey.trim() || undefined
      });

      setSummary(res.summary);
      setModelUsed(res.modelUsed || 'gemini-3.5-flash');

      const fallbackCol = defaultColumnId || activeBoard?.columns[0]?.id || 'todo';
      const formatted: ProposedTask[] = res.tasks.map(t => {
        const colValid = activeBoard?.columns.some(c => c.id === t.suggestedColumn);
        return {
          id: crypto.randomUUID(),
          title: t.title,
          description: t.description,
          priority: t.priority,
          columnId: colValid ? t.suggestedColumn : fallbackCol,
          selected: true
        };
      });

      setTasks(formatted);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setGenerating(false);
    }
  }

  async function addSelectedTasks() {
    const toAdd = tasks.filter(t => t.selected && !t.added);
    if (toAdd.length === 0) {
      setError('No tasks selected to add.');
      return;
    }
    if (!activeBoard) {
      setError('Selected board not found.');
      return;
    }

    setAdding(true);
    setError('');

    try {
      await api(`/boards/${activeBoard.id}/tasks/batch`, 'POST', {
        tasks: toAdd.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description,
          columnId: t.columnId || defaultColumnId || activeBoard.columns[0].id,
          priority: t.priority
        }))
      });

      // Mark tasks as added
      setTasks(prev =>
        prev.map(t => (toAdd.some(added => added.id === t.id) ? { ...t, added: true, selected: false } : t))
      );

      setSuccessMessage(
        `Added ${toAdd.length} ${toAdd.length === 1 ? 'task' : 'tasks'} to "${activeBoard.name}"!`
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setAdding(false);
    }
  }

  async function addSingleTask(task: ProposedTask) {
    if (!activeBoard) return;
    setAdding(true);
    setError('');
    try {
      await api(`/boards/${activeBoard.id}/tasks/batch`, 'POST', {
        tasks: [
          {
            id: task.id,
            title: task.title,
            description: task.description,
            columnId: task.columnId || defaultColumnId || activeBoard.columns[0].id,
            priority: task.priority
          }
        ]
      });

      setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, added: true, selected: false } : t)));
      setSuccessMessage(`Added "${task.title}" to "${activeBoard.name}"!`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setAdding(false);
    }
  }

  const selectedCount = tasks.filter(t => t.selected && !t.added).length;

  return (
    <>
      <Header />
      <main className="dashboard assistant-page">
        <Link className="back-link" href="/boards">
          <ArrowLeft size={15} /> All boards
        </Link>

        <div className="page-intro">
          <div>
            <span className="eyebrow">
              <Sparkles size={13} /> AI TASK HELPER · GEMINI 3.5 FLASH
            </span>
            <h1>
              Speak or describe.
              <br />
              Turn ideas into tasks<span className="lime-dot">.</span>
            </h1>
            <p>
              Brainstorm in plain English or any language. Gemini will analyze your goals,
              propose structured tasks, and add them to your board in one click.
            </p>
          </div>
        </div>

        {/* Board & Column Configuration Row */}
        <div className="assistant-controls-card">
          <div className="assistant-board-select">
            <label>
              <strong>Target board</strong>
              <select
                aria-label="Target board"
                value={selectedBoardId}
                onChange={e => setSelectedBoardId(e.target.value)}
                disabled={generating || adding || boards.length === 0}
              >
                {boards.length === 0 ? (
                  <option value="">No boards available</option>
                ) : (
                  boards.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.columns.length} columns)
                    </option>
                  ))
                )}
              </select>
            </label>

            {activeBoard && (
              <label>
                <strong>Default column</strong>
                <select
                  aria-label="Default column"
                  value={defaultColumnId}
                  onChange={e => setSelectedColOverride(e.target.value)}
                  disabled={generating || adding}
                >
                  {activeBoard.columns.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <button
              type="button"
              className="text-button"
              style={{ fontSize: 11, alignSelf: 'flex-end', paddingBottom: 8 }}
              onClick={() => setShowKeyInput(!showKeyInput)}
            >
              <Key size={13} /> {showKeyInput ? 'Hide API key' : 'Custom Gemini API Key (optional)'}
            </button>
          </div>

          {showKeyInput && (
            <div className="api-key-box">
              <label>
                <span>Google Gemini API Key</span>
                <input
                  type="password"
                  placeholder="AIzaSy... (leave empty to use server default GEMINI_API_KEY)"
                  value={apiKey}
                  onChange={e => handleSaveKey(e.target.value)}
                />
              </label>
              <p className="field-help" style={{ margin: 0, fontSize: 11 }}>
                Saved locally in your browser. If left empty, TaskBoard automatically uses the
                configured server-side <code>GEMINI_API_KEY</code>.
              </p>
            </div>
          )}
        </div>

        {/* Prompt Input & Voice Recognition Card */}
        <div className="assistant-prompt-card">
          <div className="prompt-header">
            <label htmlFor="ai-prompt-input">
              <strong>Describe what you need to do</strong>
              <span className="optional" style={{ marginLeft: 6 }}>
                Type or speak in any language
              </span>
            </label>

            {speechSupported && (
              <button
                type="button"
                className={`mic-button ${recording ? 'recording' : ''}`}
                onClick={toggleRecording}
                title={recording ? 'Stop voice recording' : 'Speak your tasks'}
                aria-pressed={recording}
              >
                {recording ? <MicOff size={16} /> : <Mic size={16} />}
                <span>{recording ? 'Listening… Stop' : 'Voice Dictate'}</span>
                {recording && <span className="recording-pulse" />}
              </button>
            )}
          </div>

          <div className="textarea-container">
            <textarea
              id="ai-prompt-input"
              rows={4}
              placeholder="e.g. We are launching our new product next week. We need to create a landing page, write 3 launch blog posts, design social banners, test checkout flow, and send an email blast to our subscriber list."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              disabled={generating}
            />
            {speechInterim && (
              <div className="speech-interim-preview" aria-live="polite">
                <span className="live-dot" /> <em>{speechInterim}</em>
              </div>
            )}
          </div>

          {/* Quick inspiration starter chips */}
          <div className="templates-row">
            <span className="template-label">Examples:</span>
            {PROMPT_TEMPLATES.map(tmpl => (
              <button
                key={tmpl.label}
                type="button"
                className="template-chip"
                onClick={() => setPrompt(tmpl.prompt)}
                disabled={generating}
              >
                {tmpl.label}
              </button>
            ))}
            {prompt && (
              <button
                type="button"
                className="text-button"
                style={{ fontSize: 11, marginLeft: 'auto' }}
                onClick={() => setPrompt('')}
              >
                <X size={13} /> Clear
              </button>
            )}
          </div>

          <div className="generate-actions">
            <button
              type="button"
              className="button"
              disabled={generating || !prompt.trim() || !online || !selectedBoardId}
              onClick={generateTasks}
            >
              {generating ? (
                <>
                  <RefreshCw size={16} className="spinning" />
                  Thinking with Gemini 3.5 Flash…
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate Tasks
                </>
              )}
            </button>
          </div>
        </div>

        <ErrorNotice message={error} />

        {successMessage && (
          <div className="assistant-success-banner" role="status">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="success-icon">
                <Check size={16} />
              </span>
              <span>{successMessage}</span>
            </div>
            {activeBoard && (
              <Link className="button secondary small-button" href={`/boards/${activeBoard.id}`}>
                View board <ArrowRight size={14} />
              </Link>
            )}
          </div>
        )}

        {/* Proposed Tasks Review */}
        {tasks.length > 0 && (
          <section className="proposed-section" aria-label="Proposed tasks">
            <div className="proposed-header">
              <div>
                <h2>
                  Proposed Tasks <span className="count">{tasks.length}</span>
                </h2>
                {summary && <p className="proposed-summary">{summary}</p>}
                {modelUsed && (
                  <span className="model-badge">
                    <Sparkles size={11} /> Model: {modelUsed}
                  </span>
                )}
              </div>

              <div className="proposed-actions">
                <button
                  type="button"
                  className="button secondary small-button"
                  onClick={() => {
                    const allSelected = tasks.every(t => t.selected || t.added);
                    setTasks(tasks.map(t => (t.added ? t : { ...t, selected: !allSelected })));
                  }}
                  disabled={adding}
                >
                  {tasks.every(t => t.selected || t.added) ? 'Deselect all' : 'Select all'}
                </button>

                <button
                  type="button"
                  className="button"
                  onClick={addSelectedTasks}
                  disabled={adding || selectedCount === 0 || !online}
                >
                  {adding ? (
                    'Adding tasks…'
                  ) : (
                    <>
                      <Plus size={16} />
                      Add {selectedCount} {selectedCount === 1 ? 'Task' : 'Tasks'} to{' '}
                      {activeBoard?.name || 'Board'}
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="proposed-list">
              {tasks.map((task, idx) => (
                <article
                  key={task.id}
                  className={`proposed-card ${task.added ? 'added' : task.selected ? 'selected' : ''}`}
                >
                  <div className="proposed-card-header">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={task.selected}
                        disabled={task.added || adding}
                        onChange={e => {
                          const val = e.target.checked;
                          setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, selected: val } : t)));
                        }}
                      />
                      <span className="task-index">#{idx + 1}</span>
                    </label>

                    <input
                      className="task-title-input"
                      value={task.title}
                      disabled={task.added || adding}
                      aria-label="Task title"
                      onChange={e => {
                        const val = e.target.value;
                        setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, title: val } : t)));
                      }}
                    />

                    {task.added ? (
                      <span className="presence-tag online" style={{ marginLeft: 'auto' }}>
                        <Check size={12} /> Added
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="button secondary small-button"
                        style={{ marginLeft: 'auto', padding: '5px 10px', fontSize: 11 }}
                        disabled={adding || !online}
                        onClick={() => addSingleTask(task)}
                      >
                        <Plus size={13} /> Add
                      </button>
                    )}
                  </div>

                  <textarea
                    className="task-desc-input"
                    rows={2}
                    value={task.description}
                    disabled={task.added || adding}
                    placeholder="Task details or checklist…"
                    aria-label="Task description"
                    onChange={e => {
                      const val = e.target.value;
                      setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, description: val } : t)));
                    }}
                  />

                  <div className="proposed-card-meta">
                    <label className="meta-select-label">
                      <span>Column:</span>
                      <select
                        value={task.columnId}
                        disabled={task.added || adding || !activeBoard}
                        onChange={e => {
                          const val = e.target.value;
                          setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, columnId: val } : t)));
                        }}
                      >
                        {activeBoard?.columns.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="meta-select-label">
                      <span>Priority:</span>
                      <select
                        value={task.priority}
                        disabled={task.added || adding}
                        onChange={e => {
                          const val = e.target.value as 'none' | 'low' | 'medium' | 'high';
                          setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, priority: val } : t)));
                        }}
                      >
                        <option value="none">None</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </label>

                    <span className={`priority priority-${task.priority}`}>{task.priority}</span>

                    {!task.added && (
                      <button
                        type="button"
                        className="icon-button danger-text"
                        style={{ marginLeft: 'auto' }}
                        title="Remove from proposal"
                        aria-label="Remove task from proposal"
                        onClick={() => setTasks(prev => prev.filter(t => t.id !== task.id))}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
