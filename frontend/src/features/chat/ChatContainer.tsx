import React, { useRef, useEffect } from 'react';
import { Sparkles, Shield, BookOpen, Calculator, Building, FileUp, Globe } from 'lucide-react';
import { ChatMessage as MessageType } from '../../types';
import { ChatMessage } from './ChatMessage';
import { Logo } from '../../components/Logo';

interface ChatContainerProps {
  messages: MessageType[];
  isLoading: boolean;
  onSelectPrompt: (prompt: string) => void;
  onOpenIpcCalculator?: () => void;
  onOpenDocuments?: () => void;
  onExportPdf?: (question: string, message: MessageType) => Promise<void>;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  isLoading,
  onSelectPrompt,
  onOpenIpcCalculator,
  onOpenDocuments,
  onExportPdf,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const starterCards = [
    {
      title: 'Incremento de Canon según IPC',
      desc: '¿Cuánto me pueden subir el arriendo este año según la Ley 820 y el IPC oficial del DANE?',
      icon: Calculator,
      tag: 'Ley 820 Art. 20 + Web',
    },
    {
      title: 'Depósitos y Cauciones Prohibidas',
      desc: '¿Es legal que me exijan depósitos en efectivo para alquilar vivienda urbana?',
      icon: Shield,
      tag: 'Ley 820 Art. 16',
    },
    {
      title: 'Cuotas Extraordinarias y Quórum 70%',
      desc: '¿Qué quórum exige la Ley 675 para aprobar una cuota extraordinaria en un conjunto y cómo impugnarla?',
      icon: Building,
      tag: 'Ley 675 Art. 46 & 49',
    },
    {
      title: 'Preaviso y Terminación de Contrato',
      desc: '¿Cuál es el plazo de preaviso e indemnización para terminar un contrato de arrendamiento de vivienda?',
      icon: BookOpen,
      tag: 'Ley 820 Art. 22 & 24',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-5 bg-cream-100">
      {messages.length === 0 ? (
        <div className="max-w-3xl mx-auto py-4 sm:py-8 space-y-6 animate-fadeIn">
          {/* Hero Welcome Box */}
          <div className="text-center space-y-3">
            <div className="flex justify-center mb-2">
              <Logo size="lg" showText={false} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-display text-slate-900">
                Asistente Normativo <span className="text-teal-700">LegalProp AI</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
                Resuelve dudas sobre <strong className="text-slate-800">arrendamientos</strong> y{' '}
                <strong className="text-slate-800">propiedad horizontal</strong> en Colombia con citas verificables,
                análisis real de tus archivos (<strong className="text-slate-800">PDF, DOCX, TXT, Excel</strong>) y búsqueda web en tiempo real.
              </p>
            </div>

            {/* Accesos Rápidos a Herramientas */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs">
              <button
                type="button"
                onClick={onOpenDocuments}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-teal-50 border border-cream-300 hover:border-teal-400 text-slate-800 font-semibold text-[11px] shadow-soft transition-all"
              >
                <FileUp className="w-3.5 h-3.5 text-teal-700" />
                <span>Subir PDF / Word / TXT</span>
              </button>
              <button
                type="button"
                onClick={onOpenIpcCalculator}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-amber-50 border border-cream-300 hover:border-amber-400 text-slate-800 font-semibold text-[11px] shadow-soft transition-all"
              >
                <Calculator className="w-3.5 h-3.5 text-amber-700" />
                <span>Calculadora IPC Arriendo</span>
              </button>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-sky-900 font-medium text-[11px]">
                <Globe className="w-3.5 h-3.5 text-sky-700" />
                <span>Grounding Web en Vivo</span>
              </span>
            </div>
          </div>

          {/* Tarjetas de Consultas Iniciales */}
          <div className="bg-cream-50 rounded-2xl p-5 border border-cream-300/80 shadow-soft space-y-3.5">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-teal-700" />
              <span>Preguntas frecuentes para iniciar:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {starterCards.map((card, i) => {
                const IconComponent = card.icon;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSelectPrompt(card.desc)}
                    className="group text-left p-3.5 rounded-xl bg-white hover:bg-cream-100/60 border border-cream-200 hover:border-teal-400 transition-all duration-150 shadow-soft flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <IconComponent className="w-3.5 h-3.5 text-teal-700" />
                      </div>
                      <span className="text-[10px] font-mono text-slate-600 bg-cream-150 px-2 py-0.5 rounded border border-cream-200">
                        {card.tag}
                      </span>
                    </div>
                    <span className="font-bold text-xs text-slate-900 group-hover:text-teal-800 transition-colors">
                      {card.title}
                    </span>
                    <p className="text-[11px] text-slate-600 mt-1 leading-snug">{card.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        messages.map((msg, idx) => {
          const prevQuestion =
            msg.role === 'assistant' && idx > 0 && messages[idx - 1].role === 'user'
              ? messages[idx - 1].content
              : undefined;
          return (
            <ChatMessage
              key={msg.id}
              message={msg}
              previousQuestion={prevQuestion}
              onSelectFollowup={onSelectPrompt}
              onExportPdf={onExportPdf}
            />
          );
        })
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};
