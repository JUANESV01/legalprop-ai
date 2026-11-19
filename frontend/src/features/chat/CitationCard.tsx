import React, { useState } from 'react';
import { BookMarked, ChevronDown, ChevronUp, FileText, Globe, ExternalLink, FileCheck2 } from 'lucide-react';
import { Citation } from '../../types';

interface CitationCardProps {
  citation: Citation;
  index: number;
}

export const CitationCard: React.FC<CitationCardProps> = ({ citation, index }) => {
  const [expanded, setExpanded] = useState(false);

  const isWeb = citation.source_type === 'web' || Boolean(citation.url);
  const isUserDoc = citation.source_type === 'documento_usuario';

  const iconBoxClass = isWeb
    ? 'bg-sky-50 border-sky-200 text-sky-700'
    : isUserDoc
    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
    : 'bg-teal-50 border-teal-200 text-teal-700';

  const typeBadge = isWeb
    ? { label: 'Web en vivo', cls: 'text-sky-800 bg-sky-50 border-sky-200' }
    : isUserDoc
    ? { label: 'Tu documento', cls: 'text-emerald-800 bg-emerald-50 border-emerald-200' }
    : { label: 'Ley marco', cls: 'text-teal-800 bg-teal-50 border-teal-200' };

  return (
    <div className="rounded-xl border border-cream-200 bg-cream-50 overflow-hidden text-xs transition-all duration-150 hover:border-teal-400 shadow-soft">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="w-full px-3 py-2.5 text-left flex items-center justify-between hover:bg-cream-100/60 transition-colors"
      >
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${iconBoxClass}`}>
            {isWeb ? (
              <Globe className="w-3 h-3" />
            ) : isUserDoc ? (
              <FileCheck2 className="w-3 h-3" />
            ) : (
              <BookMarked className="w-3 h-3" />
            )}
          </div>
          <span className="font-semibold text-slate-800 truncate">
            [{index + 1}] {citation.norma} {citation.articulo ? `• ${citation.articulo}` : ''}
          </span>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0 ml-2">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${typeBadge.cls}`}>
            {typeBadge.label}
          </span>
          {citation.similarity_score !== undefined && !isWeb && (
            <span className="hidden sm:inline text-[10px] font-mono text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
              {Math.round(citation.similarity_score * 100)}%
            </span>
          )}
          <span className="text-slate-400 hover:text-slate-600">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="p-3 pt-2 border-t border-cream-200 bg-white space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 font-medium">
            <div className="flex items-center space-x-1.5 truncate">
              <FileText className="w-3.5 h-3.5 text-teal-700 shrink-0" />
              <span className="truncate">Fuente: {citation.source_title}</span>
            </div>
            {citation.url && (
              <a
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sky-700 hover:text-sky-900 font-semibold underline shrink-0"
              >
                <span>Abrir enlace</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <p className="text-slate-700 font-sans text-xs leading-relaxed bg-cream-50/80 p-3 rounded-lg border border-cream-200 whitespace-pre-wrap">
            {citation.fragmento}
          </p>
        </div>
      )}
    </div>
  );
};
