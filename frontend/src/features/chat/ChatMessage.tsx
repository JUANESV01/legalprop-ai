import React from 'react';
import { User, Scale, ShieldAlert } from 'lucide-react';
import { ChatMessage as MessageType } from '../../types';
import { CitationCard } from './CitationCard';

interface ChatMessageProps {
  message: MessageType;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-4 p-4 rounded-xl transition-all ${isUser ? 'bg-slate-900/30 ml-8' : 'bg-slate-900/80 mr-8 border border-slate-800/80 shadow-md'}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isUser ? 'bg-slate-800 text-slate-300' : 'bg-gradient-to-br from-amber-500 to-indigo-600 text-slate-950 font-bold'}`}>
        {isUser ? <User className="w-4 h-4" /> : <Scale className="w-4 h-4" />}
      </div>

      <div className="flex-1 space-y-3 overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">
            {isUser ? 'Tú (Consultante)' : 'LegalProp AI'}
          </span>
          <span className="text-[10px] text-slate-500">{message.timestamp}</span>
        </div>

        <div className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>

        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Fuentes Normativas de Respaldo ({message.citations.length})
            </div>
            <div className="grid grid-cols-1 gap-2">
              {message.citations.map((c, idx) => (
                <CitationCard key={idx} citation={c} index={idx} />
              ))}
            </div>
          </div>
        )}

        {!isUser && (
          <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 pt-1">
            <ShieldAlert className="w-3 h-3 text-amber-500/70" />
            <span>Respuesta fundamentada orientativa. Consulta con un abogado ante litigios formales.</span>
          </div>
        )}
      </div>
    </div>
  );
};
