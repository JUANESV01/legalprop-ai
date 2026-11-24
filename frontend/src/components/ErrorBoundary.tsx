import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Error inesperado en la interfaz.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('LegalProp AI ErrorBoundary:', error, info.componentStack);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-cream-100 flex items-center justify-center p-6 text-slate-800">
          <div className="max-w-md w-full bg-white border border-cream-200 rounded-2xl shadow-card p-6 space-y-4 text-center">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-base font-bold text-slate-900">
                Ocurrió un error inesperado en la interfaz
              </h1>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tus conversaciones y documentos guardados están seguros. Recarga la página para
                continuar con tu consulta en LegalProp AI.
              </p>
            </div>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Recargar página</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
