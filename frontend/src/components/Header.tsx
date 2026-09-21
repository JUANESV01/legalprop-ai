import React from 'react';
import { Logo } from './Logo';
import { FileUp, Server, Info } from 'lucide-react';
import { BackendHealthResponse } from '../types';

interface HeaderProps {
  health: BackendHealthResponse | null;
  onOpenDocuments: () => void;
  onOpenAbout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ health, onOpenDocuments, onOpenAbout }) => {
  const isHealthy = health?.status === 'healthy';

  return (
    <header className="h-16 border-b border-cream-200 bg-cream-50/95 backdrop-blur-sm px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors shadow-soft">
      <div className="flex items-center space-x-4">
        <Logo size="md" showText={true} />
        <div className="hidden lg:block h-5 w-px bg-cream-300" />
        <p className="hidden lg:block text-xs text-slate-600 font-medium tracking-wide">
          Consultas Normativas • <span className="text-teal-700 font-semibold">Arriendos & Propiedad Horizontal</span>
        </p>
      </div>

      <div className="flex items-center space-x-2.5 sm:space-x-3">
        {/* Estado del Sistema */}
        <div className="flex items-center space-x-2 text-xs bg-teal-50/90 border border-teal-200 px-3 py-1.5 rounded-lg">
          <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-teal-600' : 'bg-amber-500'}`} />
          <span className="text-teal-900 font-medium text-[11px]">
            {isHealthy ? 'Base normativa activa' : 'Conectando servicio...'}
          </span>
        </div>

        {/* Botón Gestor Documental */}
        <button
          onClick={onOpenDocuments}
          className="flex items-center space-x-1.5 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white px-3 py-1.5 rounded-lg shadow-soft transition-all duration-150 active:scale-95"
          title="Cargar o consultar normativas y reglamentos"
        >
          <FileUp className="w-4 h-4 text-white stroke-[2.2]" />
          <span className="hidden sm:inline">Documentos</span>
        </button>

        {/* Botón Acerca del Proyecto */}
        <button
          onClick={onOpenAbout}
          className="flex items-center space-x-1.5 text-xs text-slate-700 hover:text-slate-900 bg-cream-100 hover:bg-cream-200 border border-cream-300 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
          title="Información sobre LegalProp AI y marco normativo"
        >
          <Info className="w-3.5 h-3.5 text-teal-700" />
          <span className="hidden md:inline">Acerca de</span>
        </button>

        {/* Enlace API Swagger */}
        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noreferrer"
          className="hidden xl:flex items-center space-x-1 text-xs text-slate-600 hover:text-slate-900 bg-cream-100 hover:bg-cream-200 border border-cream-300 px-2 py-1.5 rounded-lg transition-colors"
          title="Documentación técnica de la API"
        >
          <Server className="w-3.5 h-3.5 text-slate-500" />
          <span>API</span>
        </a>
      </div>
    </header>
  );
};
