import React, { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import ToastHost from './Toast'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
  <header className="bg-white shadow-sm overflow-visible">
        <div className="w-full pr-4 py-4 flex items-center justify-between">
          <BrandOrFallback />
          <nav className="space-x-4">
            <Link to="/datasets" className="text-sm text-muted">Datasets</Link>
            <Link to="/runs" className="text-sm text-muted">Runs</Link>
            <Link to="/algorithms" className="text-sm text-muted">Algorithms</Link>
            <Link to="/engines" className="text-sm text-muted">Engines</Link>
            <Link to="/dpql" className="text-sm text-muted">DPQL</Link>
            <Link to="/dpql/history" className="text-sm text-muted">DPQL History</Link>
            <Link to="/about" className="text-sm text-muted">About</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto p-4 w-full">
        <Outlet />
      </main>
      <footer className="bg-white border-t py-4 text-center text-sm text-muted">Metanome UI</footer>
      <ToastHost />
    </div>
  )
}

function BrandOrFallback() {
  const [useLegacy, setUseLegacy] = useState(true)

  if (useLegacy) {
    return (
      <Link to="/" className="select-none" title="Metanome">
        <img
          className="legacy-logo"
          src="/legacy-logo.png"
          alt="Metanome"
          onError={() => setUseLegacy(false)}
        />
      </Link>
    )
  }

  return (
    <Link
      to="/"
      className="brand-title select-none"
      title="Metanome"
    >
      <span className="brand-text brand-wolf__m">M</span>
      <span className="brand-rest brand-text">
        etanome
        <span className="wolf-walker" aria-hidden="true">
          <img
            src="/wolf.jpeg"
            alt="wolf"
            onError={(e)=>{ (e.currentTarget as HTMLImageElement).src = '/wolf.svg' }}
          />
        </span>
      </span>
    </Link>
  )
}
