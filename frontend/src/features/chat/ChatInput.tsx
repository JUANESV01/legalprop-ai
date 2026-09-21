import React, { useState, useRef, useEffect } from 'react';
import { Send, Globe, Loader2, Paperclip } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (query: string, useWebFallback: boolean) => void;
  isLoading: boolean;
  selectedCategory: 'arriendo' | 'propiedad_horizontal' | null;
  onOpenUpload?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  selectedCategory,
  onOpenUpload,
}) => {
  const [input, setInput] = useState('');
  const [useWeb, setUseWeb] = useState(false);
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
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-2.5">
        {/* Barra superior de controles del Input */}
        <div className="flex items-center justify-between px-1 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 text-[11px]">Materia:</span>
            <span className="font-semibold text-teal-800 text-[11px] bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200">
              {selectedCategory === 'arriendo'
                ? 'Arrendamientos (Ley 820)'
                : selectedCategory === 'propiedad_horizontal'
                ? 'Propiedad Horizontal (Ley 675)'
                : 'General'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle de Búsqueda Web de IPC */}
            <button
              type="button"
              onClick={() => setUseWeb(!useWeb)}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                useWeb
                  ? 'bg-teal-100 text-teal-800 border border-teal-300 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-cream-100 border border-transparent'
              }`}
              title="Permite verificar datos económicos recientes como el IPC del DANE"
            >
              <Globe className="w-3.5 h-3.5 text-teal-700" />
              <span className="text-[11px]">Consultar IPC / Web</span>
            </button>
          </div>
        </div>

        {/* Input Textarea */}
        <div className="relative flex items-end bg-white border border-cream-300 rounded-2xl shadow-soft transition-all duration-150 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/10">
          {/* Botón Adjuntar Archivos (PDF, DOCX, etc.) */}
          <div className="p-2 sm:p-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenUpload}
              className="p-2 rounded-xl text-slate-500 hover:text-teal-800 hover:bg-cream-100 transition-colors"
              title="Adjuntar reglamento, contrato o documento propio (PDF, Word, Excel, etc.)"
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
            placeholder="Escribe tu consulta sobre arriendo o propiedad horizontal (ej. ¿Cuál es el tope de incremento este año?)..."
            disabled={isLoading}
            className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm py-3.5 focus:outline-none resize-none max-h-36 disabled:opacity-50 font-sans"
          />

          <div className="p-2 sm:p-2.5 shrink-0">
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
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

        {/* Leyenda inferior humana */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
          <span>Enter para enviar • Shift + Enter para salto de línea</span>
          <span>Respuestas orientativas con base en la legislación colombiana.</span>
        </div>
      </form>
    </div>
  );
};
