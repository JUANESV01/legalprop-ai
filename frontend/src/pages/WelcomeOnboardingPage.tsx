import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Scale,
  Building2,
  Layers,
  FileUp,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { DocumentUploader } from '../features/documents/DocumentUploader';
import { DocumentUploadResponse, UserProfile } from '../types';

type FocusChoice = 'arriendo' | 'propiedad_horizontal' | null;

interface WelcomeOnboardingPageProps {
  user: UserProfile | null;
  onSelectCategory: (cat: FocusChoice) => void;
  onUploadSuccess: (uploaded?: DocumentUploadResponse) => void;
  onNavigate: (path: string) => void;
}

const PROMPTS_BY_FOCUS: Record<string, string[]> = {
  arriendo: [
    '¿Cuánto puede subir mi arriendo este año según el IPC?',
    '¿Con cuánto tiempo de anticipación debo avisar para terminar mi contrato?',
    '¿Es legal que me pidan depósito en efectivo al arrendar?',
  ],
  propiedad_horizontal: [
    '¿La administración puede cobrarme multas sin debido proceso?',
    '¿Qué quórum se necesita en asamblea para aprobar cuotas extraordinarias?',
    '¿Pueden restringirme el acceso a la portería por mora en administración?',
  ],
  all: [
    '¿Cuánto puede subir mi arriendo este año según el IPC?',
    '¿Qué quórum se exige en asamblea para cuotas extraordinarias (Ley 675)?',
    '¿Qué obligaciones tiene el propietario frente a reparaciones locativas?',
  ],
};

export const WelcomeOnboardingPage: React.FC<WelcomeOnboardingPageProps> = ({
  user,
  onSelectCategory,
  onUploadSuccess,
  onNavigate,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [focus, setFocus] = useState<FocusChoice>(null);
  const [uploadedTitle, setUploadedTitle] = useState<string | null>(null);

  const finishOnboarding = (targetPath = '/chat/new') => {
    try {
      localStorage.setItem('legalprop_onboarding_done', '1');
    } catch {
      /* sin localStorage */
    }
    onSelectCategory(focus);
    onNavigate(targetPath);
  };

  const firstName = user?.full_name?.trim().split(/\s+/)[0] || '';
  const focusKey = focus || 'all';
  const suggestedPrompts = PROMPTS_BY_FOCUS[focusKey];

  return (
    <div className="min-h-screen bg-cream-100 text-slate-800 flex flex-col font-sans">
      {/* Barra superior limpia */}
      <header className="border-b border-cream-200 bg-cream-50/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-left focus:outline-none"
          >
            <Logo size="sm" showText={true} />
          </button>

          <button
            type="button"
            onClick={() => finishOnboarding('/chat/new')}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            Omitir e ir al chat
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-2xl space-y-6">
          {/* Indicador de pasos */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className={`h-1.5 rounded-full transition-all ${
                    n === step
                      ? 'w-10 bg-teal-700'
                      : n < step
                      ? 'w-6 bg-teal-500/60'
                      : 'w-6 bg-cream-300'
                  }`}
                />
              ))}
            </div>
            <span className="text-[11px] font-mono text-slate-500">Paso {step} de 3</span>
          </div>

          <div className="bg-white border border-cream-200 rounded-2xl shadow-card p-6 sm:p-8 space-y-6">
            {/* PASO 1: Enfoque inicial */}
            {step === 1 && (
              <>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-teal-800">
                    {firstName ? `¡Bienvenido, ${firstName}!` : '¡Bienvenido a LegalProp AI!'}
                  </p>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-950 font-display">
                    ¿Qué tema jurídico quieres priorizar hoy?
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-600">
                    Ajustaremos tus filtros y ejemplos iniciales. Podrás cambiarlo en cualquier momento dentro del chat.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      value: 'arriendo' as FocusChoice,
                      title: 'Arriendos',
                      desc: 'Ley 820 de 2003, IPC, depósitos y contratos.',
                      icon: Scale,
                    },
                    {
                      value: 'propiedad_horizontal' as FocusChoice,
                      title: 'Propiedad Horizontal',
                      desc: 'Ley 675 de 2001, asambleas, cuotas y convivencia.',
                      icon: Building2,
                    },
                    {
                      value: null as FocusChoice,
                      title: 'Ambos temas',
                      desc: 'Búsqueda abierta en toda la normativa colombiana.',
                      icon: Layers,
                    },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const active = focus === opt.value;
                    return (
                      <button
                        key={opt.title}
                        type="button"
                        onClick={() => setFocus(opt.value)}
                        className={`text-left p-4 rounded-xl border transition-all space-y-2 ${
                          active
                            ? 'bg-teal-50/70 border-teal-700 ring-1 ring-teal-700/20'
                            : 'bg-cream-50/50 border-cream-200 hover:border-cream-300'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            active
                              ? 'bg-teal-700 text-white'
                              : 'bg-white border border-cream-200 text-teal-700'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="text-xs font-bold text-slate-950">{opt.title}</div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCategory(focus);
                      setStep(2);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold transition-colors"
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}

            {/* PASO 2: Subir documento opcional */}
            {step === 2 && (
              <>
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800">
                    <FileUp className="w-3.5 h-3.5" />
                    <span>Opcional</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-950 font-display">
                    ¿Tienes un contrato o reglamento para analizar?
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-600">
                    Súbelo ahora en PDF, Word, TXT, Excel o imagen para consultarlo directamente en tu primer chat. Tus archivos quedan privados en tu cuenta.
                  </p>
                </div>

                {uploadedTitle ? (
                  <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 flex items-center gap-3 text-xs text-teal-900">
                    <CheckCircle2 className="w-5 h-5 text-teal-700 shrink-0" />
                    <div>
                      <div className="font-semibold">Documento indexado: {uploadedTitle}</div>
                      <div className="text-teal-800/80">
                        Ya quedó activo y listo para responder preguntas sobre su contenido.
                      </div>
                    </div>
                  </div>
                ) : (
                  <DocumentUploader
                    onUploadSuccess={(uploaded) => {
                      onUploadSuccess(uploaded);
                      setUploadedTitle(uploaded?.title || 'Documento cargado');
                    }}
                    isMaster={user?.role === 'master'}
                    defaultPublic={false}
                  />
                )}

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Atrás</span>
                  </button>

                  <div className="flex items-center gap-2.5">
                    {!uploadedTitle && (
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-cream-100 transition-colors"
                      >
                        Ahora no
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold transition-colors"
                    >
                      <span>{uploadedTitle ? 'Seguir' : 'Continuar'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* PASO 3: Listo + primera pregunta */}
            {step === 3 && (
              <>
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Todo listo</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-950 font-display">
                    Elige tu primera consulta o entra directo al chat
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-600">
                    Puedes hacer clic en una consulta sugerida para iniciar de inmediato o abrir una conversación en blanco.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() =>
                        finishOnboarding(`/chat/new?q=${encodeURIComponent(prompt)}`)
                      }
                      className="w-full text-left px-4 py-3 rounded-xl bg-cream-50 hover:bg-teal-50/60 border border-cream-200 hover:border-teal-300 text-xs sm:text-sm text-slate-800 flex items-center justify-between gap-3 transition-colors group"
                    >
                      <span>{prompt}</span>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-700 shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Atrás</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => finishOnboarding('/chat/new')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold transition-colors"
                  >
                    <span>Ir al chat nuevo</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
