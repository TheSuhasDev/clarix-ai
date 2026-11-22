import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Clarix UI caught error in component tree:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '24px',
            backgroundColor: '#0c131d',
            color: '#f8fafc',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          <div
            style={{
              maxWidth: '600px',
              width: '100%',
              backgroundColor: '#111827',
              border: '1px solid #dc2626',
              borderRadius: '8px',
              padding: '24px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <AlertTriangle width={28} height={28} color="#ef4444" />
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#f87171' }}>Console View Error</h2>
            </div>
            <p style={{ fontSize: '0.86rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '16px' }}>
              An unexpected error occurred while rendering this view. Clarix fail-safe prevented complete UI crash.
            </p>
            <pre
              style={{
                backgroundColor: '#030712',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #374151',
                fontSize: '0.78rem',
                color: '#fca5a5',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                marginBottom: '16px',
              }}
            >
              {this.state.error?.message || 'Unknown component error'}
            </pre>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <RefreshCw width={14} height={14} /> Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
