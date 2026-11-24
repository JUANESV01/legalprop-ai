import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Cpu, Globe, Paperclip, Square, X } from 'lucide-react';
import { AIProvider, DocumentSummary } from '../../types';

interface ChatInputProps {
  onSendMessage: (query: string, useWebFallback: boolean) => void;
  onStopStreaming?: () => void;
  isLoading: boolean;
  onOpenUpload?: () => void;
  userDocuments?: DocumentSummary[];
  selectedDocIds?: string[];
  onToggleDocId?: (docId: string) => void;
  aiProvider: AIProvider;
  onChangeAiProvider: (provider: AIProvider) => void;
}

const PROVIDER_OPTIONS: Array<{ id: AIProvider; label: string; title: string }> = [
  { id: 'auto', label: 'Auto', title: 'Selección automática (óptimo + respaldo entre Gemini y Grok)' },
  { id: 'gemini', label: 'Gemini', title: 'Google Gemini Flash + Google Search Grounding' },
  { id: 'grok', label: 'Grok', title: 'xAI Grok (con respaldo automático si no hay créditos)' },
];

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onStopStreaming,
  isLoading,
  onOpenUpload,
  userDocuments = [],
  selectedDocIds = [],
  onToggleDocId,
  aiProvider,
  onChangeAiProvider,
}) => {
  const [input, setInput] = useState('');
  // Web en modo automático por defecto para TTFT < 1s; se activa sola ante IPC/DANE/sentencias
  const [useWeb, setUseWeb] = useState(false);
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
        {userDocuments.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap px-1" aria-label="Documentos propios disponibles">
            {userDocuments.slice(0, 5).map((doc) => {
              const isFocused = selectedDocIds.includes(doc.id);
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => onToggleDocId?.(doc.id)}
                  aria-pressed={isFocused}
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] border transition-colors ${
                    isFocused
                      ? 'bg-teal-700 text-white border-teal-700'
                      : 'bg-white text-slate-800 border-cream-300 hover:border-teal-600'
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

        <div className="bg-white border border-cream-300 rounded-2xl shadow-card focus-within:border-teal-700 focus-within:ring-2 focus-within:ring-teal-700/15 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu consulta sobre propiedad horizontal, arriendos, contratos o tus archivos..."
            disabled={isLoading}
            aria-label="Escribe tu consulta jurídica"
            className="w-full bg-transparent text-slate-900 placeholder:text-slate-500 text-sm px-4 pt-3.5 pb-2 focus:outline-none resize-none max-h-36 disabled:opacity-50"
          />

          <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={onOpenUpload}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-slate-700 hover:text-slate-950 hover:bg-cream-100 transition-colors"
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
                    ? 'bg-teal-50 text-teal-900 font-medium border border-teal-200'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-cream-100'
                }`}
                title="Web auto activa búsqueda solo cuando se requieren cifras vigentes (IPC, DANE, jurisprudencia). Actívala para forzar búsqueda web."
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{useWeb ? 'Web forzada' : 'Web auto'}</span>
              </button>

              {/* Selector de motor de IA: Automático / Gemini / Grok */}
              <div
                className="inline-flex items-center rounded-xl bg-cream-100/90 border border-cream-200 p-0.5"
                role="group"
                aria-label="Selector de motor de inteligencia artificial"
              >
                <span className="pl-1.5 pr-1 text-slate-600 hidden md:inline-flex" aria-hidden="true">
                  <Cpu className="w-3.5 h-3.5" />
                </span>
                {PROVIDER_OPTIONS.map((opt) => {
                  const active = aiProvider === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChangeAiProvider(opt.id)}
                      aria-pressed={active}
                      title={opt.title}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                        active
                          ? 'bg-teal-700 text-white shadow-soft'
                          : 'text-slate-700 hover:text-slate-950'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {isLoading && onStopStreaming ? (
              <button
                type="button"
                onClick={onStopStreaming}
                aria-label="Detener respuesta"
                title="Detener generación en curso"
                className="w-8 h-8 rounded-xl bg-rose-700 hover:bg-rose-800 text-white flex items-center justify-center transition-all shrink-0"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                aria-label="Enviar consulta"
                className="w-8 h-8 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-35 text-white flex items-center justify-center transition-all shrink-0"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
