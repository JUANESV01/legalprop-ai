import React, { useRef, useEffect } from 'react';
import { Sparkles, Shield, BookOpen, Calculator, Building } from 'lucide-react';
import { ChatMessage as MessageType } from '../../types';
import { ChatMessage } from './ChatMessage';
import { Logo } from '../../components/Logo';

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

  const starterCards = [
    {
      title: 'Incremento de Canon según IPC',
      desc: '¿Cuánto me pueden subir el arriendo este año según la Ley 820 y el IPC?',
      icon: Calculator,
      tag: 'Ley 820 Art. 20',
    },
    {
      title: 'Depósitos y Cauciones Prohibidas',
      desc: '¿Es legal que me exijan depósitos en efectivo para alquilar vivienda?',
      icon: Shield,
      tag: 'Ley 820 Art. 16',
    },
    {
      title: 'Ruidos Molestos y Convivencia en PH',
      desc: '¿Cómo se sanciona el ruido excesivo de vecinos según la Ley 675?',
      icon: Building,
      tag: 'Ley 675 Art. 59',
    },
    {
      title: 'Zonas Comunes y Propietarios en Mora',
      desc: '¿Pueden cortar el ascensor o prohibir áreas comunes por cuotas atrasadas?',
      icon: BookOpen,
      tag: 'Corte Constitucional',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-5 bg-cream-100">
      {messages.length === 0 ? (
        <div className="max-w-3xl mx-auto py-6 sm:py-10 space-y-7 animate-fadeIn">
          {/* Hero Welcome Box */}
          <div className="text-center space-y-3">
            <div className="flex justify-center mb-2">
              <Logo size="lg" showText={false} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-display text-slate-900">
                Asistente Normativo <span className="text-teal-700">LegalProp</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
                Resuelve dudas sobre <strong className="text-slate-800">contratos de arrendamiento</strong> y <strong className="text-slate-800">convivencia en conjuntos o edificios</strong> con base en la legislación colombiana vigente y artículos verificables.
              </p>
            </div>

            {/* Badges de Cobertura Normativa */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs">
              <span className="px-3 py-1 rounded-full bg-white border border-cream-300 text-slate-700 font-mono text-[11px] shadow-soft">
                Ley 820 de 2003 (Arriendos)
              </span>
              <span className="px-3 py-1 rounded-full bg-white border border-cream-300 text-slate-700 font-mono text-[11px] shadow-soft">
                Ley 675 de 2001 (Propiedad Horizontal)
              </span>
              <span className="px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-mono text-[11px] shadow-soft">
                Jurisprudencia Constitucional
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
                    <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                      {card.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
      )}

      {/* Estado de Búsqueda y Redacción */}
      {isLoading && (
        <div className="flex gap-3.5 p-4 sm:p-5 rounded-2xl bg-cream-50 border border-teal-200 shadow-soft mr-4 sm:mr-12 animate-pulse">
          <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-teal-700 animate-spin" />
          </div>
          <div className="space-y-2.5 flex-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-teal-900">
                Buscando en la normativa aplicable y redactando respuesta...
              </span>
            </div>
            <div className="h-2 bg-cream-200 rounded-full w-4/5"></div>
            <div className="h-2 bg-cream-200 rounded-full w-3/5"></div>
            <div className="h-2 bg-cream-200 rounded-full w-2/5"></div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};
