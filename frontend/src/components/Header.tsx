import React from 'react';
import { PanelLeft, PanelLeftClose, FileUp, Calculator } from 'lucide-react';
import { Logo } from './Logo';
import { BackendHealthResponse } from '../types';

interface HeaderProps {
  health: BackendHealthResponse | null;
  sidebarOpen: boolean;
  userDocsCount: number;
  conversationTitle?: string;
  onToggleSidebar: () => void;
  onOpenDocuments: () => void;
  onOpenIpc: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  sidebarOpen,
  userDocsCount,
  conversationTitle,
  onToggleSidebar,
  onOpenDocuments,
  onOpenIpc,
}) => {
  const isHealthy = health?.status === 'healthy';

  return (
    <header className="h-14 border-b border-cream-200/90 bg-cream-50/90 backdrop-blur-sm px-3 sm:px-5 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-cream-200/60 transition-colors"
          title={sidebarOpen ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
          aria-label={sidebarOpen ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
        >
          {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
        </button>

        <Logo size="sm" showText={true} />

        {conversationTitle && (
          <>
            <span className="hidden md:inline text-cream-400 text-sm">/</span>
            <span className="hidden md:inline text-xs font-medium text-slate-600 truncate max-w-xs">
              {conversationTitle}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span
          className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-slate-500 mr-1"
          title={isHealthy ? 'Servicio conectado' : 'Conectando...'}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-teal-600' : 'bg-amber-500'}`} />
          <span className="hidden md:inline">{isHealthy ? 'En línea' : 'Conectando'}</span>
        </span>

        <button
          type="button"
          onClick={onOpenIpc}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-cream-100 border border-cream-300/90 transition-colors"
          title="Calculadora de incremento legal de arriendo (IPC)"
        >
          <Calculator className="w-3.5 h-3.5 text-teal-700" />
          <span className="hidden sm:inline">IPC</span>
        </button>

        <button
          type="button"
          onClick={onOpenDocuments}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 transition-colors"
          title="Subir o gestionar documentos (PDF, DOCX, TXT)"
        >
          <FileUp className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Documentos</span>
          {userDocsCount > 0 && (
            <span className="text-[10px] font-mono bg-white/20 px-1.5 rounded-full">
              {userDocsCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
