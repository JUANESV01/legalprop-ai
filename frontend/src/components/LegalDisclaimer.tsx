import React, { useState } from 'react';

export const LegalDisclaimer: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <footer className="w-full bg-cream-100 border-t border-cream-200/70 px-4 py-1.5 text-[11px] text-slate-500">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
        <span className="truncate">
          Orientación normativa basada en Ley 820 de 2003 y Ley 675 de 2001. No sustituye asesoría de un abogado titulado.
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-teal-800 hover:underline font-medium shrink-0"
        >
          {expanded ? 'Ocultar' : 'Alcance'}
        </button>
      </div>
      {expanded && (
        <div className="max-w-3xl mx-auto mt-1.5 pt-1.5 border-t border-cream-200 text-[11px] text-slate-500 leading-relaxed">
          LegalProp AI tiene fines informativos y académicos. Ninguna respuesta constituye concepto jurídico vinculante ni representación judicial.
        </div>
      )}
    </footer>
  );
};
