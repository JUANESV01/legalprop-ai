import React, { useState } from 'react';
import { User, Copy, Check, Printer, ShieldAlert } from 'lucide-react';
import { ChatMessage as MessageType } from '../../types';
import { CitationCard } from './CitationCard';
import { Logo } from '../../components/Logo';

interface ChatMessageProps {
  message: MessageType;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className={`flex gap-3.5 p-4 sm:p-5 rounded-2xl transition-all duration-200 ${
        isUser
          ? 'bg-teal-700 text-white ml-4 sm:ml-12 shadow-soft'
          : 'bg-white border border-cream-200 mr-4 sm:mr-12 shadow-soft'
      }`}
    >
      {/* Avatar Icon */}
      <div className="shrink-0 mt-0.5">
        {isUser ? (
          <div className="w-8 h-8 rounded-xl bg-teal-800/80 border border-teal-600/60 flex items-center justify-center text-teal-100 shadow-soft">
            <User className="w-4 h-4" />
          </div>
        ) : (
          <Logo size="sm" showText={false} />
        )}
      </div>

      {/* Contenido del Mensaje */}
      <div className="flex-1 space-y-3 min-w-0 overflow-hidden">
        {/* Cabecera del Mensaje */}
        <div className={`flex items-center justify-between gap-2 pb-2 border-b ${isUser ? 'border-teal-600/60' : 'border-cream-200'}`}>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold tracking-wide ${isUser ? 'text-white' : 'text-slate-900'}`}>
              {isUser ? 'Tú (Consulta)' : 'LegalProp'}
            </span>
          </div>

          <div className={`flex items-center gap-2 text-xs ${isUser ? 'text-teal-100' : 'text-slate-500'}`}>
            <span className="text-[10px] font-mono">{message.timestamp}</span>

            {!isUser && (
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-cream-100 text-slate-500 hover:text-slate-800 transition-colors"
                  title="Copiar respuesta"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-teal-700" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={handlePrint}
                  className="p-1 rounded hover:bg-cream-100 text-slate-500 hover:text-slate-800 transition-colors"
                  title="Imprimir respuesta"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Texto de la Respuesta */}
        <div className={`text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans ${isUser ? 'text-teal-50' : 'text-slate-800'}`}>
          {message.content}
        </div>

        {/* Bloque de Fuentes Normativas (Citas) */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="pt-3 border-t border-cream-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Fundamento normativo ({message.citations.length})
              </span>
              <span className="text-[10px] text-slate-500">Artículos citados</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {message.citations.map((c, idx) => (
                <CitationCard key={idx} citation={c} index={idx} />
              ))}
            </div>
          </div>
        )}

        {/* Micro-aviso de rigor ético */}
        {!isUser && (
          <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 pt-1">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span className="leading-tight">
              Información de orientación con base en las leyes 820 de 2003 y 675 de 2001. No reemplaza a un abogado titulado.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
