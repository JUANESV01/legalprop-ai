import React from 'react';
import { Home, Building2, HelpCircle, BookOpen, ShieldCheck, Sparkles } from 'lucide-react';

interface SidebarProps {
  selectedCategory: 'arriendo' | 'propiedad_horizontal' | null;
  onSelectCategory: (cat: 'arriendo' | 'propiedad_horizontal' | null) => void;
  onSelectPrompt: (prompt: string, category?: 'arriendo' | 'propiedad_horizontal') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedCategory,
  onSelectCategory,
  onSelectPrompt,
}) => {
  const exampleQueries = [
    {
      label: 'Incremento máximo del canon',
      category: 'arriendo' as const,
      prompt: '¿Cuál es el porcentaje máximo legal que el arrendador puede incrementar al canon de arrendamiento cada año?',
    },
    {
      label: 'Exigencia de depósitos en efectivo',
      category: 'arriendo' as const,
      prompt: '¿Puede el arrendador exigirme un mes de depósito en efectivo como garantía para entregar el inmueble?',
    },
    {
      label: 'Sanciones por ruidos en PH',
      category: 'propiedad_horizontal' as const,
      prompt: '¿Qué procedimiento y sanciones puede aplicar la administración de un conjunto por ruido excesivo en horario nocturno?',
    },
    {
      label: 'Restricción de zonas comunes',
      category: 'propiedad_horizontal' as const,
      prompt: '¿Puede la administración prohibirme usar el ascensor o las escaleras si estoy en mora con la cuota de administración?',
    },
  ];

  return (
    <aside className="w-80 border-r border-slate-800 bg-slate-900/40 p-4 flex flex-col justify-between hidden lg:flex">
      <div className="space-y-6">
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2.5">
            Ámbito Normativo
          </label>
          <div className="space-y-1.5">
            <button
              onClick={() => onSelectCategory(null)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                selectedCategory === null
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <BookOpen className="w-4 h-4 text-slate-400" />
                <span>Todo el Corpus</span>
              </div>
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">Ambos</span>
            </button>

            <button
              onClick={() => onSelectCategory('arriendo')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                selectedCategory === 'arriendo'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Home className="w-4 h-4 text-amber-400" />
                <span>Arrendamiento Urbano</span>
              </div>
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">Ley 820</span>
            </button>

            <button
              onClick={() => onSelectCategory('propiedad_horizontal')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                selectedCategory === 'propiedad_horizontal'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Building2 className="w-4 h-4 text-indigo-400" />
                <span>Propiedad Horizontal</span>
              </div>
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">Ley 675</span>
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2.5">
            Consultas Frecuentes
          </label>
          <div className="space-y-2">
            {exampleQueries.map((item, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPrompt(item.prompt, item.category)}
                className="w-full text-left p-2.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-xs text-slate-300 transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-200 group-hover:text-amber-300 transition-colors">
                    {item.label}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {item.category === 'arriendo' ? 'Arriendo' : 'PH'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {item.prompt}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800/80 space-y-2 text-[11px] text-slate-400">
        <div className="flex items-center space-x-2 text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="font-medium">Rigor Normativo Verificado</span>
        </div>
        <p className="text-[10px] text-slate-400 leading-normal">
          Cada respuesta está fundamentada en fragmentos normativos indexados. No sustituye la asesoría de un profesional del derecho.
        </p>
      </div>
    </aside>
  );
};
