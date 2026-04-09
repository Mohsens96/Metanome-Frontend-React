import React from 'react'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-accent text-white p-8 shadow-sm">
        <div className="relative z-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Metanome Dashboard</h1>
          <p className="mt-2 text-white/80 max-w-2xl">Run algorithms, manage datasets, and explore results — all in one place.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/runs/new"
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-white border border-white/20 hover:bg-white/20 transition select-none"
            >
              <PlayIcon />
              Start new run
            </Link>
            <Link
              to="/datasets"
              className="inline-flex items-center gap-2 rounded-lg bg-white text-primary px-4 py-2 hover:opacity-90 transition select-none"
            >
              <DatabaseIcon className="text-primary" />
              Manage datasets
            </Link>
          </div>
        </div>

        {/* decorative blobs */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 h-48 w-48 rounded-full bg-white/10 blur-xl" />
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Runs"
          value="History"
          to="/runs"
          gradient="from-cyan-500 to-sky-500"
          Icon={ClockIcon}
        />
        <StatCard
          title="Algorithms"
          value="Library"
          to="/algorithms"
          gradient="from-emerald-500 to-teal-500"
          Icon={CpuIcon}
        />
        <StatCard
          title="Upload Algorithm"
          value="Upload"
          to="/algorithms/upload"
          gradient="from-fuchsia-500 to-pink-500"
          Icon={UploadIcon}
        />
        <StatCard
          title="About Metanome"
          value="About"
          to="/about"
          gradient="from-amber-500 to-orange-500"
          Icon={InfoIcon}
        />
      </section>

      {/* Quick links */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white p-6 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-semibold">Quick links</h3>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <QuickLink to="/runs/new" title="New run" desc="Configure and run algorithms" Icon={PlayIcon} />
            <QuickLink to="/datasets" title="Datasets" desc="Manage and browse datasets" Icon={DatabaseIcon} />
            <QuickLink to="/upload" title="Upload dataset" desc="Add a new file" Icon={UploadIcon} />
          </div>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Tips</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted list-disc pl-5">
            <li>To run quickly, upload a dataset first, then choose an algorithm.</li>
            <li>Use the History page to track current and past runs.</li>
            <li>Use the top navigation for fast access to all sections.</li>
          </ul>
        </div>
      </section>
    </div>
  )
}

/* UI bits */
function StatCard({
  title,
  value,
  to,
  gradient,
  Icon,
}: {
  title: string
  value: string
  to: string
  gradient: string
  Icon: (props?: { className?: string }) => JSX.Element
}) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-xl border bg-white p-5 shadow-sm transition hover:shadow select-none"
    >
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${gradient} opacity-20 blur-xl`} />
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <div className="text-sm text-muted">{value}</div>
          <div className="mt-1 text-lg font-semibold">{title}</div>
        </div>
        <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-accent to-primary/80 text-white grid place-items-center shadow-sm">
          <Icon />
        </div>
      </div>
    </Link>
  )
}

function QuickLink({ to, title, desc, Icon }: { to: string; title: string; desc: string; Icon: (props: { className?: string }) => JSX.Element }) {
  return (
    <Link
      to={to}
      className="flex items-start gap-3 rounded-lg border p-4 hover:shadow-sm transition bg-white"
    >
      <div className="mt-1 h-9 w-9 rounded-md bg-gradient-to-br from-accent to-primary/80 text-white grid place-items-center">
        <Icon />
      </div>
      <div>
        <div className="font-medium leading-tight">{title}</div>
        <div className="text-sm text-muted leading-tight">{desc}</div>
      </div>
    </Link>
  )
}

/* Minimal inline icons (no extra deps) */
function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7-11-7z" />
    </svg>
  )
}

function DatabaseIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3c-4.97 0-9 1.79-9 4v10c0 2.21 4.03 4 9 4s9-1.79 9-4V7c0-2.21-4.03-4-9-4zm0 2c3.87 0 7 .9 7 2s-3.13 2-7 2-7-.9-7-2 .13-2 7-2zm0 14c-3.87 0-7-.9-7-2v-2c1.61 1.02 4.31 1.66 7 1.66S17.39 16.02 19 15v2c0 1.1-3.13 2-7 2zm0-6c-3.87 0-7-.9-7-2V9c1.61 1.02 4.31 1.66 7 1.66S17.39 10.02 19 9v2c0 1.1-3.13 2-7 2z" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 11h-5V11h4V6h1v7z" />
    </svg>
  )
}

function CpuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9 4V2h2v2h2V2h2v2h2a2 2 0 0 1 2 2v2h2v2h-2v2h2v2h-2v2a2 2 0 0 1-2 2h-2v2h-2v-2h-2v2H9v-2H7a2 2 0 0 1-2-2v-2H3v-2h2v-2H3V8h2V6a2 2 0 0 1 2-2h2zm-2 4v8h10V8H7zm2 2h6v4H9v-4z" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M5 20h14v-2H5v2zM12 2l5 5h-3v6h-4V7H7l5-5z" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11 7h2v2h-2V7zm0 4h2v6h-2v-6zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
    </svg>
  )
}
