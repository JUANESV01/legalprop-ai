import React from 'react';
import { Scale, Sparkles, Database, ExternalLink } from 'lucide-react';
import { BackendHealthResponse } from '../types';

interface HeaderProps {
  health: BackendHealthResponse | null;
  onOpenDocuments: () => void;
}

export const Header: React.FC<HeaderProps> = ({ health, onOpenDocuments }) => {
  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-amber-500 p-0.5 flex items-center justify-center shadow-lg shadow-blue-500/10">
          <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
            <Scale className="w-5 h-5 text-amber-400" />
          </div>
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-bold text-lg text-slate-100 tracking-tight flex items-center gap-1.5">
              LegalProp <span className="text-amber-400">AI</span>
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md">
              RAG + Gemini 3.7
            </span>
          </div>
          <p className="text-xs text-slate-400">Asistente Normativo para Arriendos y Propiedad Horizontal</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {health && (
          <div className="hidden md:flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-lg">
            <div className={`w-2 h-2 rounded-full ${health.status === 'healthy' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span>ChromaDB: <strong className="text-slate-200">{health.vector_store.total_chunks} fragmentos</strong></span>
          </div>
        )}

        <button
          onClick={onOpenDocuments}
          className="flex items-center space-x-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 px-3.5 py-1.5 rounded-lg transition-colors"
          title="Ver o cargar normativas base"
        >
          <Database className="w-4 h-4 text-blue-400" />
          <span>Normativas</span>
        </button>

        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noreferrer"
          className="hidden sm:flex items-center space-x-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <span>Swagger API</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </header>
  );
};
