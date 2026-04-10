import React from 'react';
import { AlertTriangle } from 'lucide-react';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-rose-500/10 rounded-3xl flex items-center justify-center mb-6">
            <AlertTriangle className="text-rose-500" size={32} />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight mb-2">Something went wrong</h2>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-relaxed max-w-xs mx-auto mb-8">
            The application encountered an unexpected error. We've been notified and are looking into it.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-emerald-500 text-black font-black py-4 px-8 rounded-2xl shadow-xl shadow-emerald-500/10 hover:bg-emerald-600 transition-all uppercase text-[10px] tracking-widest"
          >
            Reload Application
          </button>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-8 p-4 bg-zinc-900 rounded-xl text-left text-[10px] text-rose-400 overflow-auto max-w-full font-mono">
              {this.state.error?.toString()}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;