import React, { useState, useRef, useEffect } from 'react';
import { Send, Globe, Loader2, Paperclip, FileCheck2, X } from 'lucide-react';
import { DocumentSummary } from '../../types';

interface ChatInputProps {
  onSendMessage: (query: string, useWebFallback: boolean) => void;
  isLoading: boolean;
  selectedCategory: 'arriendo' | 'propiedad_horizontal' | 'manual_interno' | null;
  onOpenUpload?: () => void;
  userDocuments?: DocumentSummary[];
  selectedDocIds?: string[];
  onToggleDocId?: (docId: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  selectedCategory,
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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
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
    <div className="border-t border-cream-200 bg-cream-50/95 backdrop-blur-sm p-3 sm:p-4">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-2">
        {/* Documentos propios activos (visible cuando el usuario ha subido PDF/DOCX/TXT) */}
        {userDocuments.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap px-1">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
              <FileCheck2 className="w-3 h-3" />
              Tus archivos activos:
            </span>
            {userDocuments.slice(0, 5).map((doc) => {
              const isFocused = selectedDocIds.includes(doc.id);
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => onToggleDocId?.(doc.id)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                    isFocused
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-soft'
                      : 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:border-emerald-400'
                  }`}
                  title={
                    isFocused
                      ? 'Documento priorizado en la consulta (clic para quitar prioridad)'
                      : 'Clic para priorizar este documento en tu pregunta'
                  }
                >
                  <span className="max-w-[140px] truncate">{doc.title}</span>
                  <span className="opacity-75 uppercase font-mono text-[9px]">.{doc.file_type}</span>
                  {isFocused && <X className="w-2.5 h-2.5" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Barra superior de controles del Input */}
        <div className="flex items-center justify-between px-1 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 text-[11px]">Materia:</span>
            <span className="font-semibold text-teal-800 text-[11px] bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200">
              {selectedCategory === 'arriendo'
                ? 'Arrendamientos (Ley 820)'
                : selectedCategory === 'propiedad_horizontal'
                ? 'Propiedad Horizontal (Ley 675)'
                : selectedCategory === 'manual_interno'
                ? 'Manuales e Internos'
                : 'General'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle de Búsqueda Web en Tiempo Real */}
            <button
              type="button"
              onClick={() => setUseWeb(!useWeb)}
              aria-pressed={useWeb}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                useWeb
                  ? 'bg-sky-50 text-sky-900 border border-sky-300 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-cream-100 border border-cream-200'
              }`}
              title="Activa o desactiva la búsqueda en la web en tiempo real (Google Search / DANE / jurisprudencia)"
            >
              <Globe className={`w-3.5 h-3.5 ${useWeb ? 'text-sky-700' : 'text-slate-400'}`} />
              <span className="text-[11px]">{useWeb ? 'Búsqueda Web: ON' : 'Búsqueda Web: Auto'}</span>
            </button>
          </div>
        </div>

        {/* Input Textarea */}
        <div className="relative flex items-end bg-white border border-cream-300 rounded-2xl shadow-soft transition-all duration-150 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/10">
          {/* Botón Adjuntar Archivos (PDF, DOCX, TXT, XLSX, etc.) */}
          <div className="p-2 sm:p-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenUpload}
              className="p-2 rounded-xl text-slate-500 hover:text-teal-800 hover:bg-cream-100 transition-colors"
              title="Subir reglamento, contrato o documento propio (PDF, DOCX, TXT, XLSX, ODT, imágenes)"
              aria-label="Subir documento o reglamento"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          </div>

          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu consulta sobre arriendo, propiedad horizontal o tus archivos cargados..."
            disabled={isLoading}
            aria-label="Escribe tu consulta jurídica"
            className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm py-3.5 focus:outline-none resize-none max-h-36 disabled:opacity-50 font-sans"
          />

          <div className="p-2 sm:p-2.5 shrink-0">
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              aria-label="Enviar consulta"
              className="w-10 h-10 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-30 disabled:hover:bg-teal-700 text-white font-bold flex items-center justify-center transition-all duration-150 shadow-soft active:scale-95"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Send className="w-4 h-4 text-white stroke-[2.2]" />
              )}
            </button>
          </div>
        </div>

        {/* Leyenda inferior */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
          <span>Enter para enviar • Shift + Enter para salto de línea</span>
          <span className="hidden sm:inline">Streaming SSE en vivo • Citas verificables + Web Grounding</span>
        </div>
      </form>
    </div>
  );
};
