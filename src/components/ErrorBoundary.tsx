import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Terjadi kesalahan pada aplikasi.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-lg w-full rounded-xl border border-red-200 bg-white p-6">
            <div className="flex items-center gap-2 text-red-700 font-semibold">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              <span>Terjadi Gangguan Sistem</span>
            </div>
            <p className="mt-2 text-sm text-slate-600 break-words">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0C3D68]"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
