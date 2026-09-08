'use client';

import React from 'react';

/**
 * Atmospheric gradient wash rendered with SVG blur filter.
 * Creates the signature soft halo effect behind editorial hero and feature cards.
 */
export function AtmosphericWash({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <svg
        className="h-full w-full opacity-60 mix-blend-multiply filter"
        viewBox="0 0 1200 800"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <g filter="url(#atmospheric-blur)">
          <circle cx="350" cy="280" r="240" fill="#ff9473" fillOpacity="0.45" />
          <circle cx="680" cy="320" r="280" fill="#a0b5eb" fillOpacity="0.55" />
          <circle cx="880" cy="460" r="220" fill="#a7fccd" fillOpacity="0.45" />
          <circle cx="500" cy="520" r="200" fill="#ecda98" fillOpacity="0.35" />
        </g>
        <defs>
          <filter id="atmospheric-blur" x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse">
            <feGaussianBlur stdDeviation="90" result="blur" />
          </filter>
        </defs>
      </svg>
    </div>
  );
}

/**
 * Main Interactive Pipeline & Kanban Diagram.
 * Depicts data ingestion from disparate inputs, passing through the Firestore
 * authoritative sync hub into deterministic Kanban columns with fractional rank indexing.
 */
export function PipelineDiagramSvg({ className = '' }: { className?: string }) {
  return (
    <div className={`relative w-full overflow-hidden rounded-[32px] border border-[#cecac8] bg-[#f6f3f1] p-6 sm:p-10 ${className}`}>
      {/* Background grid texture */}
      <svg className="absolute inset-0 h-full w-full stroke-[#cecac8]/40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="diagram-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" strokeWidth="0.75" strokeDasharray="3 3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#diagram-grid)" />
      </svg>

      {/* Header bar of the diagram */}
      <div className="relative z-10 mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#cecac8] pb-4 font-mono text-[11px] uppercase tracking-wider text-[#4e4d4d]">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[#2b59d1]" />
          <span>SPEC // REAL-TIME TOPOLOGY & STATE ORCHESTRATION</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-[#cecac8] bg-white px-3 py-1 text-[10px] text-[#242424]">
            LATENCY: &lt; 200MS
          </span>
          <span className="rounded-full border border-[#cecac8] bg-white px-3 py-1 text-[10px] text-[#242424]">
            ZERO CLIENT WRITES
          </span>
        </div>
      </div>

      {/* SVG canvas for flow lines and nodes */}
      <div className="relative z-10">
        <svg
          viewBox="0 0 960 480"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-auto w-full"
        >
          <defs>
            <linearGradient id="flow-gradient-1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#a0b5eb" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#2b59d1" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#a7fccd" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="flow-gradient-2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff9473" stopOpacity="0.3" />
              <stop offset="60%" stopColor="#2b59d1" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#a0b5eb" stopOpacity="0.8" />
            </linearGradient>
            <filter id="hub-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="16" result="blur" />
            </filter>
          </defs>

          {/* Connection Curves from Source Nodes to Central Sync Hub */}
          <path
            d="M 180 120 C 270 120, 310 240, 420 240"
            stroke="#a0b5eb"
            strokeWidth="1.75"
            strokeDasharray="4 4"
            className="animate-pulse"
          />
          <path
            d="M 180 240 C 280 240, 320 240, 420 240"
            stroke="#2b59d1"
            strokeWidth="2"
          />
          <path
            d="M 180 360 C 270 360, 310 240, 420 240"
            stroke="#ff9473"
            strokeWidth="1.75"
            strokeDasharray="4 4"
          />

          {/* Connection Curves from Sync Hub to Column Targets */}
          <path
            d="M 540 240 C 620 240, 640 130, 710 130"
            stroke="url(#flow-gradient-1)"
            strokeWidth="2"
          />
          <path
            d="M 540 240 C 620 240, 640 240, 710 240"
            stroke="#2b59d1"
            strokeWidth="2.25"
          />
          <path
            d="M 540 240 C 620 240, 640 350, 710 350"
            stroke="url(#flow-gradient-2)"
            strokeWidth="2"
          />

          {/* FLOW PARTICLES */}
          <circle cx="280" cy="180" r="3.5" fill="#2b59d1" />
          <circle cx="340" cy="240" r="4" fill="#2b59d1" />
          <circle cx="280" cy="300" r="3.5" fill="#ff9473" />
          <circle cx="630" cy="180" r="3.5" fill="#a0b5eb" />
          <circle cx="640" cy="240" r="4" fill="#2b59d1" />
          <circle cx="630" cy="300" r="3.5" fill="#a7fccd" />

          {/* SOURCE NODES (Left Column) */}
          {/* Node 1 */}
          <g transform="translate(40, 95)">
            <rect width="140" height="50" rx="25" fill="#ffffff" stroke="#cecac8" strokeWidth="1" />
            <circle cx="25" cy="25" r="7" fill="#f6f3f1" stroke="#242424" strokeWidth="1" />
            <path d="M 22 25 L 28 25 M 25 22 L 25 28" stroke="#242424" strokeWidth="1" />
            <text x="42" y="24" fontFamily="monospace" fontSize="10" fontWeight="500" fill="#242424" letterSpacing="0.05em">RAW INBOX</text>
            <text x="42" y="36" fontFamily="monospace" fontSize="8" fill="#797776">EVENT STREAM</text>
          </g>

          {/* Node 2 */}
          <g transform="translate(40, 215)">
            <rect width="140" height="50" rx="25" fill="#ffffff" stroke="#242424" strokeWidth="1.25" />
            <circle cx="25" cy="25" r="7" fill="#cfdaf5" stroke="#2b59d1" strokeWidth="1" />
            <circle cx="25" cy="25" r="3" fill="#2b59d1" />
            <text x="42" y="24" fontFamily="monospace" fontSize="10" fontWeight="600" fill="#242424" letterSpacing="0.05em">USER ACTION</text>
            <text x="42" y="36" fontFamily="monospace" fontSize="8" fill="#2b59d1">DRAG & DROP</text>
          </g>

          {/* Node 3 */}
          <g transform="translate(40, 335)">
            <rect width="140" height="50" rx="25" fill="#ffffff" stroke="#cecac8" strokeWidth="1" />
            <circle cx="25" cy="25" r="7" fill="#f6f3f1" stroke="#242424" strokeWidth="1" />
            <path d="M 21 27 L 29 23" stroke="#242424" strokeWidth="1" />
            <text x="42" y="24" fontFamily="monospace" fontSize="10" fontWeight="500" fill="#242424" letterSpacing="0.05em">PEER SYNC</text>
            <text x="42" y="36" fontFamily="monospace" fontSize="8" fill="#797776">VERIFIED TOKEN</text>
          </g>

          {/* CENTRAL SYNC HUB */}
          <g transform="translate(480, 240)">
            {/* Glow Aura */}
            <circle cx="0" cy="0" r="65" fill="#a7fccd" opacity="0.3" filter="url(#hub-glow)" />
            <circle cx="0" cy="0" r="50" fill="#cfdaf5" opacity="0.5" />
            <circle cx="0" cy="0" r="42" fill="#ffffff" stroke="#2b59d1" strokeWidth="1.5" />
            {/* Outer dotted orbit */}
            <circle cx="0" cy="0" r="46" stroke="#cecac8" strokeWidth="1" strokeDasharray="3 3" fill="none" />
            {/* Center glyph */}
            <circle cx="0" cy="0" r="14" fill="#2b59d1" />
            <path d="M -6 -2 L 0 6 L 6 -2" stroke="#ffffff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <text x="0" y="22" fontFamily="monospace" fontSize="8" fontWeight="600" fill="#242424" textAnchor="middle" letterSpacing="0.08em">
              FIRESTORE
            </text>
            <text x="0" y="31" fontFamily="monospace" fontSize="7" fill="#797776" textAnchor="middle">
              ACID MUTATIONS
            </text>
          </g>

          {/* DESTINATION KANBAN NODES (Right Columns) */}
          {/* Target Column 1: TO DO */}
          <g transform="translate(710, 85)">
            <rect width="210" height="90" rx="16" fill="#ffffff" stroke="#cecac8" strokeWidth="1" />
            <rect x="0" y="0" width="210" height="28" rx="16" fill="#f6f3f1" />
            <rect x="0" y="18" width="210" height="10" fill="#f6f3f1" />
            <line x1="0" y1="28" x2="210" y2="28" stroke="#cecac8" strokeWidth="0.75" />
            <circle cx="16" cy="14" r="3" fill="#242424" />
            <text x="26" y="17" fontFamily="monospace" fontSize="9" fontWeight="600" fill="#242424">01 // TO DO</text>
            <text x="195" y="17" fontFamily="monospace" fontSize="8" fill="#797776" textAnchor="end">[3]</text>

            {/* Task Card in column */}
            <rect x="12" y="38" width="186" height="42" rx="8" fill="#f6f3f1" stroke="#cecac8" strokeWidth="0.75" />
            <text x="22" y="52" fontFamily="Georgia, serif" fontSize="10" fill="#242424">Architecture review</text>
            <rect x="22" y="60" width="48" height="12" rx="6" fill="#cfdaf5" />
            <text x="46" y="69" fontFamily="monospace" fontSize="7" fill="#2b59d1" textAnchor="middle">RANK 1024</text>
            <circle cx="184" cy="59" r="6" fill="#ffffff" stroke="#cecac8" strokeWidth="0.75" />
            <text x="184" y="62" fontFamily="monospace" fontSize="7" fill="#242424" textAnchor="middle">W</text>
          </g>

          {/* Target Column 2: IN FLIGHT */}
          <g transform="translate(710, 195)">
            <rect width="210" height="90" rx="16" fill="#ffffff" stroke="#2b59d1" strokeWidth="1.25" />
            <rect x="0" y="0" width="210" height="28" rx="16" fill="#cfdaf5" />
            <rect x="0" y="18" width="210" height="10" fill="#cfdaf5" />
            <line x1="0" y1="28" x2="210" y2="28" stroke="#a0b5eb" strokeWidth="0.75" />
            <circle cx="16" cy="14" r="3" fill="#2b59d1" />
            <text x="26" y="17" fontFamily="monospace" fontSize="9" fontWeight="600" fill="#2b59d1">02 // IN PROGRESS</text>
            <text x="195" y="17" fontFamily="monospace" fontSize="8" fill="#2b59d1" textAnchor="end">ACTIVE</text>

            {/* Active Task Card */}
            <rect x="12" y="38" width="186" height="42" rx="8" fill="#ffffff" stroke="#2b59d1" strokeWidth="1" />
            <text x="22" y="52" fontFamily="Georgia, serif" fontSize="10" fill="#242424">Editorial landing craft</text>
            <rect x="22" y="60" width="58" height="12" rx="6" fill="#2b59d1" />
            <text x="51" y="69" fontFamily="monospace" fontSize="7" fill="#ffffff" textAnchor="middle">HIGH PRIORITY</text>
            <rect x="84" y="60" width="48" height="12" rx="6" fill="#a7fccd" />
            <text x="108" y="69" fontFamily="monospace" fontSize="7" fill="#242424" textAnchor="middle">LIVE SYNC</text>
          </g>

          {/* Target Column 3: DONE */}
          <g transform="translate(710, 305)">
            <rect width="210" height="90" rx="16" fill="#ffffff" stroke="#cecac8" strokeWidth="1" />
            <rect x="0" y="0" width="210" height="28" rx="16" fill="#f6f3f1" />
            <rect x="0" y="18" width="210" height="10" fill="#f6f3f1" />
            <line x1="0" y1="28" x2="210" y2="28" stroke="#cecac8" strokeWidth="0.75" />
            <circle cx="16" cy="14" r="3" fill="#4e4d4d" />
            <text x="26" y="17" fontFamily="monospace" fontSize="9" fontWeight="600" fill="#242424">03 // DONE</text>
            <text x="195" y="17" fontFamily="monospace" fontSize="8" fill="#797776" textAnchor="end">[18]</text>

            {/* Completed Task Card */}
            <rect x="12" y="38" width="186" height="42" rx="8" fill="#f6f3f1" stroke="#cecac8" strokeWidth="0.75" />
            <text x="22" y="52" fontFamily="Georgia, serif" fontSize="10" fill="#797776" textDecoration="line-through">Vercel sin1 production release</text>
            <rect x="22" y="60" width="42" height="12" rx="6" fill="#e9eddd" />
            <text x="43" y="69" fontFamily="monospace" fontSize="7" fill="#4e4d4d" textAnchor="middle">VERIFIED</text>
          </g>
        </svg>
      </div>

      {/* Legend footer */}
      <div className="relative z-10 mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#cecac8] pt-4 font-mono text-[11px] text-[#4e4d4d]">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-6 rounded-full bg-[#2b59d1]" />
            <span>AUTHORITATIVE MUTATION ROUTE</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-6 rounded-full bg-[#a0b5eb]" />
            <span>REAL-TIME LISTENER BROADCAST</span>
          </span>
        </div>
        <span className="text-[#797776]">MONAD ARCHITECTURE SPEC // TASKBOARD 1.0</span>
      </div>
    </div>
  );
}

/**
 * Geometric Transform Illustration for the Periwinkle Mist Card.
 * Expresses mathematical fractional ranking: interpolating between (prev + next) / 2
 * without locking tables or reindexing hundreds of items.
 */
export function StateTransformSvg({ className = '' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 420 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto w-full max-w-[420px]"
      >
        <defs>
          <linearGradient id="geom-coral-sky" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff9473" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#a0b5eb" stopOpacity="0.75" />
          </linearGradient>
          <linearGradient id="geom-sky-mint" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a0b5eb" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#a7fccd" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="geom-gold-coral" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ecda98" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#ff9473" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* Mathematical coordinate axis */}
        <line x1="30" y1="230" x2="390" y2="230" stroke="#242424" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="50" y1="20" x2="50" y2="250" stroke="#242424" strokeWidth="1" strokeDasharray="3 3" />

        {/* Floating Rank Interval Formula Text */}
        <text x="60" y="45" fontFamily="monospace" fontSize="10" fill="#242424" letterSpacing="0.04em">
          R_new = (R_prev + R_next) / 2
        </text>
        <text x="60" y="60" fontFamily="monospace" fontSize="8" fill="#4e4d4d">
          COLLISION THRESHOLD: Δ &lt; 0.0001 → REBALANCE(2048)
        </text>

        {/* Geometric Translucent Shapes */}
        {/* Shape 1: Coral / Sky Oval */}
        <ellipse
          cx="170"
          cy="150"
          rx="95"
          ry="65"
          transform="rotate(-15 170 150)"
          fill="url(#geom-coral-sky)"
          style={{ mixBlendMode: 'multiply' }}
        />

        {/* Shape 2: Sky / Mint Polygon */}
        <polygon
          points="220,70 320,130 270,220 180,180"
          fill="url(#geom-sky-mint)"
          style={{ mixBlendMode: 'multiply' }}
        />

        {/* Shape 3: Warm Gold Center Disc */}
        <circle
          cx="240"
          cy="150"
          r="48"
          fill="url(#geom-gold-coral)"
          style={{ mixBlendMode: 'multiply' }}
        />

        {/* Discrete Position Pin Markers */}
        {/* Node A (prev) */}
        <g transform="translate(130, 180)">
          <circle cx="0" cy="0" r="5" fill="#242424" />
          <line x1="0" y1="0" x2="0" y2="50" stroke="#242424" strokeWidth="1" strokeDasharray="2 2" />
          <text x="0" y="-10" fontFamily="monospace" fontSize="9" fontWeight="600" fill="#242424" textAnchor="middle">
            1024.0
          </text>
        </g>

        {/* Node B (interpolated midpoint) */}
        <g transform="translate(230, 130)">
          <circle cx="0" cy="0" r="8" fill="#2b59d1" />
          <circle cx="0" cy="0" r="3.5" fill="#ffffff" />
          <line x1="0" y1="0" x2="0" y2="100" stroke="#2b59d1" strokeWidth="1.25" strokeDasharray="2 2" />
          <rect x="-36" y="-30" width="72" height="20" rx="10" fill="#242424" />
          <text x="0" y="-17" fontFamily="monospace" fontSize="9" fontWeight="600" fill="#ffffff" textAnchor="middle">
            1536.0
          </text>
        </g>

        {/* Node C (next) */}
        <g transform="translate(320, 160)">
          <circle cx="0" cy="0" r="5" fill="#242424" />
          <line x1="0" y1="0" x2="0" y2="70" stroke="#242424" strokeWidth="1" strokeDasharray="2 2" />
          <text x="0" y="-10" fontFamily="monospace" fontSize="9" fontWeight="600" fill="#242424" textAnchor="middle">
            2048.0
          </text>
        </g>

        {/* Interpolation Arc */}
        <path
          d="M 130 180 Q 230 100, 320 160"
          stroke="#242424"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          fill="none"
        />
      </svg>
    </div>
  );
}

/**
 * Visual Comparison Diagram:
 * Contrasting noisy legacy project tools vs. Monad TaskBoard's quiet clarity.
 */
export function ClarityVsNoiseSvg({ className = '' }: { className?: string }) {
  return (
    <div className={`grid grid-cols-1 gap-6 md:grid-cols-2 ${className}`}>
      {/* Legacy Bloat */}
      <div className="relative overflow-hidden rounded-[32px] border border-[#cecac8] bg-[#eae7e4] p-8 font-mono text-[12px]">
        <div className="mb-6 flex items-center justify-between border-b border-[#cecac8] pb-3 text-[11px] uppercase tracking-wider text-[#797776]">
          <span>CONVENTIONAL PROJECT SUITE</span>
          <span className="rounded-full bg-[#f37a0a]/20 px-2 py-0.5 text-[10px] font-semibold text-[#f37a0a]">
            HIGH NOISE
          </span>
        </div>
        <div className="space-y-3 opacity-65">
          <div className="flex items-center justify-between rounded-xl border border-[#cecac8] bg-white p-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#f37a0a]" />
              <span className="text-[#242424]">47 Unread Activity Notifications</span>
            </div>
            <span className="text-[10px] text-[#797776]">NOW</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[#cecac8] bg-white p-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#797776]" />
              <span className="text-[#4e4d4d]">18 Nested Hierarchy Permissions</span>
            </div>
            <span className="text-[10px] text-[#797776]">CONFIG</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[#cecac8] bg-white p-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#797776]" />
              <span className="text-[#4e4d4d]">Automated AI Sprint Summaries (Spam)</span>
            </div>
            <span className="text-[10px] text-[#797776]">BOT</span>
          </div>
          <div className="rounded-xl border border-dashed border-[#cecac8] p-3 text-center text-[11px] text-[#797776]">
            + Custom Field Builders, Gantt Views, Billing Walls
          </div>
        </div>
        <p className="mt-6 font-serif text-[15px] italic text-[#4e4d4d]">
          “More time spent curating the tool than finishing the work.”
        </p>
      </div>

      {/* Monad TaskBoard */}
      <div className="relative overflow-hidden rounded-[32px] border border-[#2b59d1] bg-[#ffffff] p-8 font-mono text-[12px] shadow-[0_8px_30px_rgba(43,89,209,0.06)]">
        <div className="mb-6 flex items-center justify-between border-b border-[#cfdaf5] pb-3 text-[11px] uppercase tracking-wider text-[#2b59d1]">
          <span>TASKBOARD MONAD METHOD</span>
          <span className="rounded-full bg-[#2b59d1] px-2.5 py-0.5 text-[10px] font-semibold text-white">
            PURE SIGNAL
          </span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-[#cfdaf5] bg-[#f6f3f1] p-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#2b59d1]" />
              <span className="font-semibold text-[#242424]">Private by default; Email-bound invites</span>
            </div>
            <span className="text-[10px] text-[#2b59d1]">SHA-256</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[#cecac8] bg-white p-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#a7fccd]" />
              <span className="text-[#242424]">Instant peer synchronization (&lt; 200ms)</span>
            </div>
            <span className="text-[10px] text-[#797776]">LIVE</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[#cecac8] bg-white p-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#242424]" />
              <span className="text-[#242424]">Keyboard navigation &amp; fractional order</span>
            </div>
            <span className="text-[10px] text-[#797776]">DND-KIT</span>
          </div>
          <div className="rounded-xl border border-[#a0b5eb] bg-[#cfdaf5]/40 p-3 text-center text-[11px] font-medium text-[#2b59d1]">
            Zero notifications. Zero marketing trackers. Pure focus.
          </div>
        </div>
        <p className="mt-6 font-serif text-[15px] text-[#242424]">
          “The digital equivalent of a quiet notebook on a clean desk.”
        </p>
      </div>
    </div>
  );
}
