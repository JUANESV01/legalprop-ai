import React, { useState, useRef, useEffect } from 'react';
import { Send, Globe, Sparkles, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (query: string, useWebFallback: boolean) => void;
  isLoading: boolean;
  selectedCategory: 'arriendo' | 'propiedad_horizontal' | null;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  selectedCategory,
}) => {
  const [input, setInput] = useState('');
  const [useWeb, setUseWeb] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
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
    <div className="border-t border-slate-800 bg-slate-950/80 backdrop-blur-md p-4">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-2">
        <div className="flex items-center justify-between px-1 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Ámbito activo:</span>
            <span className="font-semibold text-amber-400">
              {selectedCategory === 'arriendo'
                ? 'Arriendos (Ley 820)'
                : selectedCategory === 'propiedad_horizontal'
                ? 'Propiedad Horizontal (Ley 675)'
                : 'Todo el Corpus Legal'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setUseWeb(!useWeb)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition-colors ${
              useWeb
                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
            }`}
            title="Activa búsqueda complementaria de jurisprudencia externa"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="text-[11px]">Búsqueda Web Jurisprudencial</span>
          </button>
        </div>

        <div className="relative flex items-end bg-slate-900/90 border border-slate-700/80 rounded-xl focus-within:border-amber-500/80 focus-within:ring-1 focus-within:ring-amber-500/40 transition-all shadow-inner">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Formula tu consulta jurídica (ej. ¿Cuáles son los requisitos legales para incrementar el canon de arriendo?)..."
            disabled={isLoading}
            className="w-full bg-transparent text-slate-100 text-xs sm:text-sm px-4 py-3.5 focus:outline-none resize-none max-h-32 disabled:opacity-50"
          />

          <div className="p-2 shrink-0">
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 disabled:opacity-30 disabled:hover:from-amber-500 disabled:hover:to-indigo-600 text-slate-950 flex items-center justify-center transition-all shadow-md"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 text-slate-950 animate-spin" />
              ) : (
                <Send className="w-4 h-4 text-slate-950" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
          <span>Pulsa Enter para enviar • Shift + Enter para salto de línea</span>
          <span>Motor: Gemini 3.7 Flash + ChromaDB</span>
        </div>
      </form>
    </div>
  );
};
