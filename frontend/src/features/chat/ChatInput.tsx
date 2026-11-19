import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Globe, Loader2, Paperclip, X } from 'lucide-react';
import { DocumentSummary } from '../../types';

interface ChatInputProps {
  onSendMessage: (query: string, useWebFallback: boolean) => void;
  isLoading: boolean;
  onOpenUpload?: () => void;
  userDocuments?: DocumentSummary[];
  selectedDocIds?: string[];
  onToggleDocId?: (docId: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  onOpenUpload,
  userDocuments = [],
  selectedDocIds = [],
  onToggleDocId,
}) => {
  const [input, setInput] = useState('');
  const [useWeb, setUseWeb] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim(), useWeb);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="px-4 sm:px-6 pb-3 pt-2 bg-cream-100">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-2">
        {/* Chips discretos solo si el usuario tiene documentos propios */}
        {userDocuments.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap px-1">
            {userDocuments.slice(0, 5).map((doc) => {
              const isFocused = selectedDocIds.includes(doc.id);
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => onToggleDocId?.(doc.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] border transition-colors ${
                    isFocused
                      ? 'bg-teal-700 text-white border-teal-700'
                      : 'bg-white text-slate-700 border-cream-300 hover:border-teal-500'
                  }`}
                  title={isFocused ? 'Priorizado en tu consulta' : 'Clic para enfocar este documento'}
                >
                  <span className="max-w-[160px] truncate">{doc.title}</span>
                  {isFocused && <X className="w-3 h-3" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Caja de texto principal */}
        <div className="bg-white border border-cream-300 rounded-2xl shadow-card focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/10 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta sobre arriendos, propiedad horizontal o tus archivos..."
            disabled={isLoading}
            aria-label="Escribe tu consulta jurídica"
            className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 text-sm px-4 pt-3.5 pb-2 focus:outline-none resize-none max-h-36 disabled:opacity-50"
          />

          <div className="flex items-center justify-between px-2.5 pb-2.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onOpenUpload}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-slate-600 hover:text-slate-900 hover:bg-cream-100 transition-colors"
                title="Adjuntar PDF, Word, Excel, TXT o imagen"
              >
                <Paperclip className="w-4 h-4" />
                <span className="hidden sm:inline">Adjuntar</span>
              </button>

              <button
                type="button"
                onClick={() => setUseWeb(!useWeb)}
                aria-pressed={useWeb}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs transition-colors ${
                  useWeb
                    ? 'bg-teal-50 text-teal-800 font-medium'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-cream-100'
                }`}
                title="Buscar datos vigentes (IPC, DANE, jurisprudencia) en la web"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{useWeb ? 'Web activa' : 'Web auto'}</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              aria-label="Enviar consulta"
              className="w-8 h-8 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-30 text-white flex items-center justify-center transition-all"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
