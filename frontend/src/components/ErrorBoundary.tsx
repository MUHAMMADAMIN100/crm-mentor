import { Component, ReactNode } from 'react';
import { t } from '../i18n';

interface State { error: Error | null; }

/** Top-level safety net so React rendering errors never produce a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('[ErrorBoundary]', error, info);
  }

  reset = () => {
    this.setState({ error: null });
    location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="auth-shell" style={{ flexDirection: 'column', gap: 14 }}>
        <div className="auth-card" style={{ textAlign: 'center', maxWidth: 460 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #fee2e2, #fecaca)',
            color: '#dc2626',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>{t('err.title')}</h1>
          <p style={{ color: 'var(--text-soft)', margin: '0 0 18px', fontSize: 14 }}>
            {t('err.body')}
          </p>
          {this.state.error?.message && (
            <details style={{ textAlign: 'left', marginBottom: 18, fontSize: 12, color: 'var(--text-muted)' }}>
              <summary style={{ cursor: 'pointer' }}>{t('err.details')}</summary>
              <pre style={{
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                background: 'var(--surface-2)', padding: 8, borderRadius: 8, marginTop: 8,
              }}>{this.state.error.message}</pre>
            </details>
          )}
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={this.reset}>
            {t('btn.refresh')}
          </button>
        </div>
      </div>
    );
  }
}
