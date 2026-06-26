import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error?: Error
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {}

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React error', error, errorInfo)
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <div className="grid min-h-screen place-items-center bg-cs-bg p-4 text-cs-text">
        <section
          className="w-full max-w-lg border border-rarity-covert bg-cs-surface p-6 shadow-glow"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center border border-rarity-covert bg-rarity-covert/10 text-rarity-covert">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="font-mono text-xs uppercase text-rarity-covert">Something went wrong</p>
              <h1 className="mt-1 text-2xl font-semibold">The simulator hit an unexpected error.</h1>
              <p className="mt-3 text-sm text-cs-muted">
                Your save is stored locally. Reloading usually restores the app from the latest autosave.
              </p>
            </div>
          </div>
          <div className="mt-5 border border-cs-border bg-cs-panel p-3 font-mono text-xs text-cs-muted">
            {this.state.error.message || 'Unknown error'}
          </div>
          <button
            className="mt-5 inline-flex min-h-11 items-center gap-2 border border-rarity-special px-4 py-2 font-semibold text-rarity-special transition-colors hover:bg-rarity-special/10"
            onClick={() => window.location.reload()}
            type="button"
          >
            <RefreshCw size={16} />
            Reload App
          </button>
        </section>
      </div>
    )
  }
}
