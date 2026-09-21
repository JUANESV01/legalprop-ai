import React from 'react';
import { Database, ShieldCheck, BookOpen } from 'lucide-react';
import { BackendHealthResponse } from '../../types';

interface DocumentListProps {
  health: BackendHealthResponse | null;
}

export const DocumentList: React.FC<DocumentListProps> = ({ health }) => {
  const baseNormas = [
    {
      title: 'Ley 820 de 2003',
      sub: 'Régimen de Arrendamiento de Vivienda Urbana en Colombia',
      category: 'Arrendamientos',
      badgeColor: 'text-amber-800 bg-amber-50 border-amber-200',
      articles: 'Art. 1, 8, 9, 16 (Prohibición de depósitos), 20 (Tope IPC), 22, 24 (Causales y preaviso)',
    },
    {
      title: 'Ley 675 de 2001 y Reglamentos PH',
      sub: 'Régimen de Propiedad Horizontal y Convivencia',
      category: 'Propiedad Horizontal',
      badgeColor: 'text-teal-800 bg-teal-50 border-teal-200',
      articles: 'Art. 1, 29 (Expensas comunes), 37 (Asambleas), 50 (Administrador), 59 (Sanciones), 74 (Convivencia)',
    },
  ];

  return (
    <div className="bg-cream-50 rounded-2xl p-5 space-y-4 border border-cream-200 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-slate-900">Base Normativa Activa</h3>
            <p className="text-[11px] text-slate-500">Legislación colombiana incorporada para consultas</p>
          </div>
        </div>
        {health && (
          <span className="text-[11px] font-medium text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-soft">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
            Normativa activa
          </span>
        )}
      </div>

      <div className="space-y-3 pt-1">
        {baseNormas.map((norma, idx) => (
          <div
            key={idx}
            className="p-3.5 bg-white border border-cream-200 rounded-xl space-y-2 hover:border-teal-300 transition-all duration-150 shadow-soft"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span className="font-semibold text-xs text-slate-900">{norma.title}</span>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${norma.badgeColor}`}>
                {norma.category}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">{norma.sub}</p>
            <div className="text-[10px] font-mono text-slate-500 pt-2 border-t border-cream-200 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-teal-700 shrink-0" />
              <span>Artículos de consulta frecuente: {norma.articles}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
