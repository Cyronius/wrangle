import { Component, ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset)
      }

      return (
        <div style={{
          padding: '24px',
          color: 'var(--text-color, #ccc)',
          backgroundColor: 'var(--app-bg, #1e1e1e)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px'
        }}>
          <h2 style={{ margin: 0, color: 'var(--error-color, #f44336)' }}>Something went wrong</h2>
          <pre style={{
            maxWidth: '600px',
            overflow: 'auto',
            padding: '12px',
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: '6px',
            fontSize: '12px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={this.reset}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--accent-color, #4daafc)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
