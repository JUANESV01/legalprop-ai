import React, { useState } from 'react';
import {
  ArrowRight,
  FileUp,
  Scale,
  Building2,
  Calculator,
  FileDown,
  ShieldCheck,
  Globe,
  BookOpen,
  Send,
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { UserProfile } from '../types';

interface HomePageProps {
  user: UserProfile | null;
  onNavigate: (path: string) => void;
}

const QUICK_HOME_PROMPTS = [
  '¿Cuánto puede subir mi arriendo este año según el IPC?',
  '¿Me pueden exigir un depósito en efectivo para arrendar?',
  '¿La administración puede cobrarme multa sin debido proceso?',
];

export const HomePage: React.FC<HomePageProps> = ({ user, onNavigate }) => {
  const [heroQuestion, setHeroQuestion] = useState('');

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = heroQuestion.trim();
    if (!cleaned) {
      onNavigate('/chat/new');
      return;
    }
    onNavigate(`/chat/new?q=${encodeURIComponent(cleaned)}`);
  };

  return (
    <div className="min-h-screen bg-cream-100 text-slate-800 flex flex-col font-sans selection:bg-teal-100 selection:text-teal-900">
      {/* Navegación superior limpia */}
      <header className="sticky top-0 z-30 bg-cream-50/90 backdrop-blur-sm border-b border-cream-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-left focus:outline-none"
          >
            <Logo size="sm" showText={true} />
          </button>

          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-slate-600">
            <a href="#como-funciona" className="hover:text-slate-950 transition-colors">
              Cómo funciona
            </a>
            <a href="#marco-legal" className="hover:text-slate-950 transition-colors">
              Marco normativo
            </a>
            <a href="#privacidad" className="hover:text-slate-950 transition-colors">
              Privacidad
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            {user ? (
              <button
                type="button"
                onClick={() => onNavigate('/chat/new')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-colors"
              >
                <span>Ir a mi chat</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate('/login')}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-950 hover:bg-cream-200/70 transition-colors"
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/chat/new')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-colors"
                >
                  <span>Abrir asistente</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Editorial */}
      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-12 pb-16 sm:pt-18 sm:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200/80 px-3 py-1 rounded-full">
                <Scale className="w-3.5 h-3.5" />
                <span>Colombia • Ley 820 de 2003 y Ley 675 de 2001</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-950 leading-[1.12] font-display">
                Orientación jurídica clara sobre arriendos y propiedad horizontal.
              </h1>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
                Consulta tus derechos y deberes en lenguaje cotidiano, analiza reglamentos internos o contratos en{' '}
                <strong className="text-slate-800">PDF, Word o TXT</strong> y valida incrementos de canon según el IPC vigente — siempre con respaldo normativo verificable.
              </p>

              {/* Caja interactiva de consulta directa hacia /chat/new?q=... */}
              <form
                onSubmit={handleHeroSubmit}
                className="max-w-xl bg-white border border-cream-300 focus-within:border-teal-700/60 focus-within:ring-2 focus-within:ring-teal-700/15 rounded-2xl p-1.5 shadow-card transition-all flex items-center gap-2"
              >
                <input
                  type="text"
                  value={heroQuestion}
                  onChange={(e) => setHeroQuestion(e.target.value)}
                  placeholder="Escribe tu consulta jurídica aquí..."
                  aria-label="Escribe tu consulta jurídica"
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold shrink-0 transition-colors"
                >
                  <span>Consultar</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>

              {/* Consultas rápidas clicables */}
              <div className="flex flex-wrap gap-2 max-w-xl">
                {QUICK_HOME_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => onNavigate(`/chat/new?q=${encodeURIComponent(prompt)}`)}
                    className="text-left text-[11px] font-medium text-slate-600 hover:text-teal-900 bg-cream-50 hover:bg-white border border-cream-200 hover:border-teal-300 px-3 py-1.5 rounded-full transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Accesos rápidos a herramientas */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('/chat/new?docs=1')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-cream-50 border border-cream-300 text-slate-800 text-xs sm:text-sm font-semibold transition-colors"
                >
                  <FileUp className="w-4 h-4 text-teal-700" />
                  <span>Subir reglamento o contrato</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('/chat/new?ipc=1')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-cream-50 border border-cream-300 text-slate-800 text-xs sm:text-sm font-semibold transition-colors"
                >
                  <Calculator className="w-4 h-4 text-teal-700" />
                  <span>Calcular reajuste IPC</span>
                </button>
              </div>

              {!user && (
                <p className="text-xs text-slate-500 pt-1">
                  ¿Quieres guardar tu historial y aislar tus archivos privados?{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate('/login?tab=register')}
                    className="text-teal-800 font-semibold hover:underline"
                  >
                    Crea tu cuenta gratuita
                  </button>
                </p>
              )}
            </div>

            {/* Vista previa realista de una consulta */}
            <div className="lg:col-span-5">
              <div className="bg-white border border-cream-200 rounded-2xl shadow-elevated p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-cream-200 pb-3">
                  <span className="text-xs font-semibold text-slate-900">Ejemplo de consulta</span>
                  <span className="text-[11px] font-mono text-slate-400">/chat/new</span>
                </div>

                <div className="flex justify-end">
                  <div className="max-w-[88%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-cream-200/80 text-xs text-slate-900 leading-relaxed">
                    ¿Puede la inmobiliaria exigirme un depósito de 2 meses en efectivo para entregarme el apartamento?
                  </div>
                </div>

                <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                  <p>
                    <strong className="text-slate-950">No es legal.</strong> En contratos de arrendamiento de vivienda urbana en Colombia está expresamente prohibido exigir depósitos en dinero efectivo o cauciones reales como garantía, conforme al{' '}
                    <strong className="text-teal-800">Artículo 16 de la Ley 820 de 2003</strong>.
                  </p>
                  <p className="text-slate-600">
                    La inmobiliaria sí puede solicitar pólizas de seguro de arrendamiento o codeudores, pero no retener dinero en efectivo como depósito.
                  </p>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-cream-100">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cream-50 border border-cream-300 text-[11px] font-medium text-slate-700">
                        <BookOpen className="w-3 h-3 text-teal-700" />
                        Ver fuentes (2)
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cream-50 border border-cream-300 text-[11px] font-medium text-slate-700">
                        <FileDown className="w-3 h-3 text-teal-700" />
                        PDF
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate(
                          `/chat/new?q=${encodeURIComponent(
                            '¿Puede la inmobiliaria exigirme un depósito de 2 meses en efectivo para entregarme el apartamento?'
                          )}`
                        )
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-800 hover:text-teal-950"
                    >
                      <span>Probar en el chat</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="border-t border-cream-200 bg-cream-50 py-16 sm:py-20">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 space-y-10">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 font-display">
                Pensado para resolver dudas reales en segundos
              </h2>
              <p className="text-sm text-slate-600">
                Sin jerga procesal innecesaria y sin respuestas inventadas: cada explicación parte de normas vigentes, tus propios archivos o datos oficiales.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  step: '01',
                  title: 'Consulta en lenguaje cotidiano',
                  desc: 'Describe tu situación tal como ocurre. Si hace falta un detalle clave (vivienda vs. local comercial, conjunto vs. casa), el asistente te ayuda a precisarlo.',
                  icon: BookOpen,
                },
                {
                  step: '02',
                  title: 'Analiza tus propios documentos',
                  desc: 'Sube manuales de convivencia, actas o contratos en PDF, Word (.docx), Excel, ODT, TXT o imágenes. El sistema lee el texto real y responde con base en él.',
                  icon: FileUp,
                },
                {
                  step: '03',
                  title: 'Verifica datos vigentes y exporta',
                  desc: 'Consulta el IPC del DANE y jurisprudencia reciente en la web, calcula topes de incremento de arriendo y descarga una constancia formal en PDF.',
                  icon: Globe,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.step}
                    className="p-6 rounded-2xl bg-white border border-cream-200 space-y-3 shadow-soft"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-mono text-slate-400">{item.step}</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-950">{item.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Marco legal y herramientas */}
        <section id="marco-legal" className="border-t border-cream-200 bg-cream-100 py-16 sm:py-20">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 space-y-10">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 font-display">
                Cobertura normativa y herramientas integradas
              </h2>
              <p className="text-sm text-slate-600">
                Diseñado específicamente para inquilinos, propietarios y administradores en Colombia.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-6 rounded-2xl bg-white border border-cream-200 space-y-2.5">
                <Scale className="w-5 h-5 text-teal-700" />
                <h3 className="text-sm font-bold text-slate-950">Ley 820 de 2003 — Arriendos</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Topes de reajuste anual con IPC, prohibición de depósitos en efectivo, obligaciones de partes, preavisos de 3 meses, indemnizaciones y causales de restitución.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-cream-200 space-y-2.5">
                <Building2 className="w-5 h-5 text-teal-700" />
                <h3 className="text-sm font-bold text-slate-950">Ley 675 de 2001 — Propiedad Horizontal</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Cuotas ordinarias y extraordinarias, quórum calificado del 70%, intereses de mora, impugnación de asambleas, ruidos, mascotas y uso de bienes esenciales.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-cream-200 space-y-2.5">
                <Calculator className="w-5 h-5 text-teal-700" />
                <h3 className="text-sm font-bold text-slate-950">Calculadora IPC y Constancias PDF</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Computa automáticamente el canon máximo permitido según el IPC del año anterior y el límite del 1% del valor comercial, y exporta tus consultas en PDF.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Privacidad y cierre CTA */}
        <section id="privacidad" className="border-t border-cream-200 bg-cream-50 py-16">
          <div className="max-w-6xl mx-auto px-5 sm:px-8">
            <div className="rounded-2xl bg-white border border-cream-200 p-7 sm:p-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 shadow-soft">
              <div className="space-y-2.5 max-w-xl">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Privacidad y Habeas Data (Ley 1581 de 2012)</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-950 font-display">
                  Tus contratos y reglamentos permanecen privados en tu cuenta.
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Cada cuenta aísla sus archivos y conversaciones en PostgreSQL con contraseñas cifradas en bcrypt, recuperación reforzada con 3 preguntas de seguridad y código de respaldo, y borrado definitivo en un clic.{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate('/privacidad')}
                    className="text-teal-800 font-semibold hover:underline"
                  >
                    Leer Política de Datos y Términos de Uso →
                  </button>
                </p>
              </div>

              <div className="flex flex-wrap gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => onNavigate(user ? '/chat/new' : '/login?tab=register')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold transition-colors"
                >
                  <span>{user ? 'Ir al asistente' : 'Crear cuenta gratis'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/chat/new')}
                  className="px-5 py-3 rounded-xl bg-cream-100 hover:bg-cream-200 border border-cream-300 text-slate-800 text-xs sm:text-sm font-semibold transition-colors"
                >
                  Probar sin registro
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Pie de página */}
      <footer className="border-t border-cream-200 bg-cream-100 py-8">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <div className="space-y-1">
            <div className="font-semibold text-slate-800">
              LegalProp AI — Un producto de RTK Solutions
            </div>
            <div>
              Iniciativa tecnológica independiente desarrollada inicialmente como proyecto académico (UTP) •{' '}
              <button
                type="button"
                onClick={() => onNavigate('/privacidad')}
                className="text-teal-800 font-medium hover:underline"
              >
                Política de Datos y Términos (Ley 1581)
              </button>
            </div>
          </div>
          <p className="max-w-md text-[11px] text-slate-500 leading-relaxed sm:text-right">
            Herramienta de orientación normativa con fines informativos y académicos. No reemplaza el concepto vinculante de un abogado titulado.
          </p>
        </div>
      </footer>
    </div>
  );
};
