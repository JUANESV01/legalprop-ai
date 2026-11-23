import React, { useRef, useEffect } from 'react';
import { ChatMessage as MessageType } from '../../types';
import { ChatMessage } from './ChatMessage';
import { Logo } from '../../components/Logo';

interface ChatContainerProps {
  messages: MessageType[];
  userName?: string;
  onSelectPrompt: (prompt: string) => void;
  onExportPdf?: (question: string, message: MessageType) => Promise<void>;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  userName,
  onSelectPrompt,
  onExportPdf,
}) => {
  const lastTurnRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Solo desplaza suavemente cuando entra un mensaje nuevo del usuario,
  // evitando saltos molestos mientras lees la respuesta.
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      lastTurnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  const quickPrompts = [
    '¿Cuánto me pueden subir el arriendo este año según el IPC?',
    '¿Qué cláusulas de riesgo debo revisar antes de firmar un contrato?',
    '¿Qué quórum se exige para aprobar una cuota extraordinaria en un conjunto?',
    '¿Cómo puedo redactar un derecho de petición o terminar un contrato sin multa?',
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 bg-cream-100">
      {messages.length === 0 ? (
        <div className="max-w-2xl mx-auto h-full flex flex-col justify-center py-10 space-y-8 animate-fadeIn">
          <div className="space-y-3">
            <Logo size="md" showText={false} />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-display">
              {userName ? `Hola, ${userName.split(' ')[0]}.` : 'Bienvenido a LegalProp.'}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
              Tu asistente legal en Colombia: consulta sobre propiedad horizontal, arriendos, verificación de contratos u otras dudas jurídicas, o sube un archivo en PDF o Word para analizarlo directamente.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectPrompt(prompt)}
                className="text-left p-3.5 rounded-xl bg-white hover:bg-cream-50 border border-cream-200 hover:border-teal-500/70 text-xs sm:text-[13px] text-slate-700 hover:text-slate-950 leading-snug transition-all shadow-soft"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto space-y-7 pb-6">
          {messages.map((msg, idx) => {
            const prevQuestion =
              msg.role === 'assistant' && idx > 0 && messages[idx - 1].role === 'user'
                ? messages[idx - 1].content
                : undefined;
            const isLast = idx === messages.length - 1;
            return (
              <div key={msg.id} ref={isLast ? lastTurnRef : undefined}>
                <ChatMessage
                  message={msg}
                  previousQuestion={prevQuestion}
                  onSelectFollowup={onSelectPrompt}
                  onExportPdf={onExportPdf}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
