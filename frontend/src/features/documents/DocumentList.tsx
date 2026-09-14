import React from 'react';
import { BookOpen, FileText, CheckCircle, Database } from 'lucide-react';
import { BackendHealthResponse } from '../../types';

interface DocumentListProps {
  health: BackendHealthResponse | null;
}

export const DocumentList: React.FC<DocumentListProps> = ({ health }) => {
  const baseNormas = [
    {
      title: 'Ley 820 de 2003',
      sub: 'Régimen de Arrendamiento de Vivienda Urbana',
      category: 'Arriendo',
      badgeColor: 'text-amber-300 bg-amber-900/30 border-amber-700/40',
      articles: 'Art. 1, 8, 9, 16 (Prohibición depósitos), 20 (Incremento IPC), 22, 24 (Causales)',
    },
    {
      title: 'Ley 675 de 2001 y Reglamento PH',
      sub: 'Régimen de Propiedad Horizontal y Convivencia',
      category: 'Propiedad Horizontal',
      badgeColor: 'text-indigo-300 bg-indigo-900/30 border-indigo-700/40',
      articles: 'Art. 1, 29 (Expensas), 37 (Asambleas), 50 (Administrador), 59 (Sanciones), 74 (Ruido)',
    },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Database className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-sm text-slate-100">Base Normativa Activa</h3>
        </div>
        {health && (
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2 py-0.5 rounded">
            {health.vector_store.total_chunks} fragmentos indexados
          </span>
        )}
      </div>

      <div className="space-y-3">
        {baseNormas.map((norma, idx) => (
          <div
            key={idx}
            className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-200">{norma.title}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded border ${norma.badgeColor}`}>
                {norma.category}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">{norma.sub}</p>
            <p className="text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-900">
              Cobertura: {norma.articles}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
