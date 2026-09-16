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
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 overflow-hidden text-xs transition-all hover:border-slate-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center space-x-2 truncate">
          <BookMarked className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-semibold text-slate-200 truncate">
            [{index + 1}] {citation.norma} {citation.articulo ? `• ${citation.articulo}` : ''}
          </span>
        </div>
        <div className="flex items-center space-x-2 shrink-0 ml-2">
          {citation.similarity_score && (
            <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
              {Math.round(citation.similarity_score * 100)}% relevancia
            </span>
          )}
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="p-3 pt-1 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 mb-1">
            <FileText className="w-3 h-3" />
            <span>{citation.source_title}</span>
          </div>
          <p className="text-slate-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap bg-slate-900/80 p-2.5 rounded border border-slate-800">
            {citation.fragmento}
          </p>
        </div>
      )}
    </div>
  );
};
