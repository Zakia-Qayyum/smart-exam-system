import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { ComponentsShowcase } from '@/pages/components-showcase'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-surface">
        <header className="sticky top-0 z-40 border-b border-navy-deep bg-navy text-white">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
            <Link to="/components" className="flex items-center gap-3 focus-visible:outline-none">
              <img src="/favicon.svg" alt="" className="h-9 w-9" />
              <span className="leading-tight">
                <span className="block text-sm font-black tracking-tight">Smart Exam System</span>
                <span className="block text-[11px] font-semibold uppercase tracking-widest text-gold">
                  Air University
                </span>
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                to="/components"
                className="rounded-md px-3 py-1.5 font-semibold text-white transition-colors hover:bg-navy-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
              >
                Components
              </Link>
            </nav>
          </div>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/components" replace />} />
            <Route path="/components" element={<ComponentsShowcase />} />
            <Route path="*" element={<Navigate to="/components" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
