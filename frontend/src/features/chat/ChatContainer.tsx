import React, { useRef, useEffect } from 'react';
import { Scale, Sparkles, AlertCircle } from 'lucide-react';
import { ChatMessage as MessageType } from '../../types';
import { ChatMessage } from './ChatMessage';

interface ChatContainerProps {
  messages: MessageType[];
  isLoading: boolean;
  onSelectPrompt: (prompt: string) => void;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  isLoading,
  onSelectPrompt,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
      {messages.length === 0 ? (
        <div className="max-w-2xl mx-auto text-center py-12 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-blue-500/20 to-indigo-500/20 border border-slate-800 flex items-center justify-center mx-auto shadow-xl">
            <Scale className="w-8 h-8 text-amber-400" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
              Bienvenido a <span className="text-amber-400">LegalProp AI</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Tu asistente normativo inteligente para resolver dudas sobre arriendos de inmuebles (Ley 820) y régimen de propiedad horizontal (Ley 675) con citas normativas comprobables.
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 text-left space-y-2">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Prueba realizar consultas como:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => onSelectPrompt("¿Bajo qué causales legales puede el arrendador terminar unilateralmente el contrato de arriendo?")}
                className="text-left p-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 text-xs text-slate-300 transition-colors"
              >
                Causales de terminación de contrato de arriendo
              </button>
              <button
                onClick={() => onSelectPrompt("¿Está legalmente permitido cobrar depósitos en efectivo en contratos de vivienda urbana?")}
                className="text-left p-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 text-xs text-slate-300 transition-colors"
              >
                Legalidad de depósitos y cauciones en arriendo
              </button>
              <button
                onClick={() => onSelectPrompt("¿Cómo se sanciona el exceso de ruido en conjuntos residenciales según la Ley 675?")}
                className="text-left p-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 text-xs text-slate-300 transition-colors"
              >
                Sanciones por ruido en propiedad horizontal
              </button>
              <button
                onClick={() => onSelectPrompt("¿Puede una asamblea de copropietarios restringir el uso de ascensores a deudores morosos?")}
                className="text-left p-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 text-xs text-slate-300 transition-colors"
              >
                Restricción de zonas comunes a morosos
              </button>
            </div>
          </div>
        </div>
      ) : (
        messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
      )}

      {isLoading && (
        <div className="flex gap-4 p-4 rounded-xl bg-slate-900/60 mr-8 border border-slate-800 animate-pulse">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Scale className="w-4 h-4" />
          </div>
          <div className="space-y-2 flex-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-amber-400">Consultando corpus normativo y razonando con Gemini 3.7...</span>
            </div>
            <div className="h-3 bg-slate-800 rounded w-5/6"></div>
            <div className="h-3 bg-slate-800 rounded w-3/4"></div>
            <div className="h-3 bg-slate-800 rounded w-1/2"></div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};
