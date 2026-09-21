import React, { useState } from 'react';
import { BookMarked, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { Citation } from '../../types';

interface CitationCardProps {
  citation: Citation;
  index: number;
}

export const CitationCard: React.FC<CitationCardProps> = ({ citation, index }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-cream-200 bg-cream-50 overflow-hidden text-xs transition-all duration-150 hover:border-teal-400 shadow-soft">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2.5 text-left flex items-center justify-between hover:bg-cream-100/60 transition-colors"
      >
        <div className="flex items-center space-x-2.5 truncate">
          <div className="w-5 h-5 rounded-md bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0">
            <BookMarked className="w-3 h-3 text-teal-700" />
          </div>
          <span className="font-semibold text-slate-800 truncate">
            [{index + 1}] {citation.norma} {citation.articulo ? `• ${citation.articulo}` : ''}
          </span>
        </div>

        <div className="flex items-center space-x-2 shrink-0 ml-2">
          {citation.similarity_score !== undefined && (
            <span className="text-[10px] font-mono text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
              {Math.round(citation.similarity_score * 100)}% relevancia
            </span>
          )}
          <span className="text-slate-400 hover:text-slate-600">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="p-3 pt-2 border-t border-cream-200 bg-white space-y-2 animate-fadeIn">
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 font-medium">
            <FileText className="w-3.5 h-3.5 text-teal-700" />
            <span>Fuente: {citation.source_title}</span>
          </div>
          <p className="text-slate-700 font-sans text-xs leading-relaxed bg-cream-50/80 p-3 rounded-lg border border-cream-200 whitespace-pre-wrap">
            {citation.fragmento}
          </p>
        </div>
      )}
    </div>
  );
};
