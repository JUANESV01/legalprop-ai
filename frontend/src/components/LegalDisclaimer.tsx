import React, { useState } from 'react';
import { ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';

export const LegalDisclaimer: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <footer className="w-full bg-cream-150 border-t border-cream-300 px-4 py-2.5 text-xs text-slate-600 z-10 transition-colors shadow-soft">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-700 font-medium">
          <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0" />
          <span>
            <strong className="text-slate-900 font-semibold">AVISO DE RESPONSABILIDAD LEGAL:</strong>{' '}
            <span className="hidden md:inline text-slate-600">
              LegalProp AI es una herramienta de asistencia y orientación normativa con fines estrictamente académicos e informativos.
            </span>
          </span>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-teal-800 hover:text-teal-900 font-semibold transition-colors ml-auto flex-shrink-0"
        >
          <span>{isExpanded ? 'Ocultar detalle' : 'Leer alcance legal'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="max-w-6xl mx-auto mt-2 pt-2 border-t border-cream-300 text-slate-600 leading-relaxed text-[11px] animate-fadeIn">
          Ninguna respuesta emitida por la plataforma constituye concepto vinculante, representación judicial, formalización contractual ni sustituye la asesoría personalizada de un profesional del derecho titulado o carreras afines. Las referencias corresponden al marco legal colombiano vigente (Ley 820 de 2003 para arrendamientos urbanos y Ley 675 de 2001 para propiedad horizontal).
        </div>
      )}
    </footer>
  );
};
