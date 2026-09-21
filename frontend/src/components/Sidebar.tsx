import React from 'react';
import { Home, Building2, BookOpen, Sparkles, HelpCircle } from 'lucide-react';

interface SidebarProps {
  selectedCategory: 'arriendo' | 'propiedad_horizontal' | null;
  onSelectCategory: (cat: 'arriendo' | 'propiedad_horizontal' | null) => void;
  onSelectPrompt: (prompt: string, category?: 'arriendo' | 'propiedad_horizontal') => void;
  onOpenAbout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedCategory,
  onSelectCategory,
  onSelectPrompt,
  onOpenAbout,
}) => {
  const exampleQueries = [
    {
      label: 'Tope legal de incremento de canon',
      category: 'arriendo' as const,
      badge: 'Ley 820 Art. 20',
      prompt: '¿Cuál es el porcentaje máximo legal que el arrendador puede incrementar al canon de arrendamiento este año y qué requisitos debe cumplir?',
    },
    {
      label: 'Prohibición de depósitos en efectivo',
      category: 'arriendo' as const,
      badge: 'Ley 820 Art. 16',
      prompt: '¿Puede el arrendador o la inmobiliaria exigirme un depósito en efectivo o cheque en garantía para firmar el contrato de arrendamiento?',
    },
    {
      label: 'Sanciones por ruido y convivencia',
      category: 'propiedad_horizontal' as const,
      badge: 'Ley 675 Art. 59',
      prompt: '¿Qué sanciones puede imponer el consejo de administración por fiestas o ruido excesivo y cuál es el debido proceso?',
    },
    {
      label: 'Mascotas y restricciones en PH',
      category: 'propiedad_horizontal' as const,
      badge: 'Ley 675 Art. 74',
      prompt: '¿Puede el reglamento de propiedad horizontal prohibir la tenencia de perros o gatos en los apartamentos?',
    },
    {
      label: 'Mora y corte de servicios o ascensor',
      category: 'propiedad_horizontal' as const,
      badge: 'Corte Constitucional',
      prompt: '¿Es legal que la administración restrinja el uso de zonas comunes esenciales o el ascensor a un propietario moroso?',
    },
  ];

  return (
    <aside className="w-80 border-r border-cream-200 bg-cream-150 p-4 flex flex-col justify-between hidden lg:flex select-none">
      <div className="space-y-6 overflow-y-auto pr-1">
        {/* Materia de Consulta / Filtros */}
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2.5">
            Materia de consulta
          </label>
          <div className="space-y-1.5">
            <button
              onClick={() => onSelectCategory(null)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                selectedCategory === null
                  ? 'bg-white text-teal-800 border border-cream-300 shadow-soft font-semibold'
                  : 'text-slate-700 hover:bg-cream-200/70 hover:text-slate-900 border border-transparent'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <BookOpen className="w-4 h-4 text-teal-700" />
                <span>Toda la normativa</span>
              </div>
              <span className="text-[10px] bg-cream-200 px-2 py-0.5 rounded text-slate-600 font-mono">
                General
              </span>
            </button>

            <button
              onClick={() => onSelectCategory('arriendo')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                selectedCategory === 'arriendo'
                  ? 'bg-white text-amber-900 border border-cream-300 shadow-soft font-semibold'
                  : 'text-slate-700 hover:bg-cream-200/70 hover:text-slate-900 border border-transparent'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Home className="w-4 h-4 text-amber-700" />
                <span>Arrendamientos</span>
              </div>
              <span className="text-[10px] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-amber-800 font-mono">
                Ley 820
              </span>
            </button>

            <button
              onClick={() => onSelectCategory('propiedad_horizontal')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                selectedCategory === 'propiedad_horizontal'
                  ? 'bg-white text-teal-900 border border-teal-300 shadow-soft font-semibold'
                  : 'text-slate-700 hover:bg-cream-200/70 hover:text-slate-900 border border-transparent'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Building2 className="w-4 h-4 text-teal-700" />
                <span>Propiedad Horizontal</span>
              </div>
              <span className="text-[10px] bg-teal-50 border border-teal-200 px-2 py-0.5 rounded text-teal-800 font-mono">
                Ley 675
              </span>
            </button>
          </div>
        </div>

        {/* Consultas Habituales */}
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-700" />
            <span>Consultas habituales</span>
          </label>
          <div className="space-y-2">
            {exampleQueries.map((item, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPrompt(item.prompt, item.category)}
                className="w-full text-left p-2.5 rounded-xl bg-cream-50 hover:bg-white border border-cream-200/90 hover:border-teal-400 text-xs text-slate-700 transition-all duration-150 group shadow-soft"
              >
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="font-semibold text-slate-900 group-hover:text-teal-800 transition-colors line-clamp-1">
                    {item.label}
                  </span>
                  <span className="text-[9px] font-mono text-slate-600 bg-cream-200/80 px-1.5 py-0.5 rounded border border-cream-300 flex-shrink-0">
                    {item.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 group-hover:text-slate-800 line-clamp-2 leading-relaxed">
                  {item.prompt}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pie Lateral con enlace al Proyecto */}
      <div className="pt-4 border-t border-cream-300 space-y-2 text-xs">
        <button
          onClick={onOpenAbout}
          className="w-full text-left p-2.5 rounded-xl bg-white border border-cream-300 hover:border-teal-400 text-slate-700 hover:text-teal-800 transition-all shadow-soft group"
        >
          <div className="flex items-center space-x-2 text-teal-800 font-semibold text-xs mb-1">
            <HelpCircle className="w-3.5 h-3.5 text-teal-700" />
            <span>Sobre este proyecto</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            Conoce el propósito, la metodología de consulta y el marco legal que sustenta las respuestas.
          </p>
        </button>
      </div>
    </aside>
  );
};
