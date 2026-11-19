import React, { useState } from 'react';
import {
  Home,
  Building2,
  BookOpen,
  Sparkles,
  HelpCircle,
  Plus,
  MessageSquare,
  Trash2,
  Pencil,
  Check,
  X,
  FileText,
  Calculator,
  FileDown,
} from 'lucide-react';
import { ConversationSummary } from '../types';

interface SidebarProps {
  selectedCategory: 'arriendo' | 'propiedad_horizontal' | 'manual_interno' | null;
  onSelectCategory: (cat: 'arriendo' | 'propiedad_horizontal' | 'manual_interno' | null) => void;
  onSelectPrompt: (prompt: string, category?: 'arriendo' | 'propiedad_horizontal') => void;
  onOpenAbout?: () => void;
  onOpenIpc?: () => void;
  conversations: ConversationSummary[];
  activeConversationId?: string;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
  onExportConversationPdf: (id: string) => Promise<void>;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedCategory,
  onSelectCategory,
  onSelectPrompt,
  onOpenAbout,
  onOpenIpc,
  conversations,
  activeConversationId,
  onNewConversation,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onExportConversationPdf,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const exampleQueries = [
    {
      label: 'Tope legal de incremento de canon',
      category: 'arriendo' as const,
      badge: 'Ley 820 Art. 20',
      prompt: '¿Cuál es el porcentaje máximo legal que el arrendador puede incrementar al canon de arrendamiento de vivienda este año según el IPC oficial del DANE?',
    },
    {
      label: 'Cuotas extraordinarias y quórum 70%',
      category: 'propiedad_horizontal' as const,
      badge: 'Ley 675 Art. 46',
      prompt: '¿Qué quórum exige la Ley 675 de 2001 para aprobar una cuota extraordinaria en un conjunto residencial y cuándo se puede impugnar?',
    },
    {
      label: 'Prohibición de depósitos en efectivo',
      category: 'arriendo' as const,
      badge: 'Ley 820 Art. 16',
      prompt: '¿Puede el arrendador o la inmobiliaria exigirme un depósito en efectivo para firmar un contrato de arrendamiento de vivienda urbana?',
    },
    {
      label: 'Mascotas y restricciones en PH',
      category: 'propiedad_horizontal' as const,
      badge: 'Ley 675 Art. 75',
      prompt: '¿Puede el reglamento de propiedad horizontal prohibir la tenencia de perros o gatos en los apartamentos?',
    },
  ];

  const startRename = (conv: ConversationSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const commitRename = async (id: string) => {
    if (editTitle.trim()) {
      await onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const formatDateTag = (iso: string) => {
    try {
      const d = new Date(iso);
      const today = new Date();
      if (d.toDateString() === today.toDateString()) return 'Hoy';
      return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
    } catch {
      return '';
    }
  };

  const sidebarContent = (
    <div className="w-80 max-w-[85vw] h-full border-r border-cream-200 bg-cream-150 p-4 flex flex-col justify-between select-none">
      <div className="space-y-5 overflow-y-auto pr-1 flex-1">
        {/* Botón Nueva Consulta + Cerrar en móvil */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onNewConversation();
              onCloseMobile?.();
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold shadow-soft transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Consulta</span>
          </button>
          {mobileOpen && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden p-2 rounded-xl bg-white border border-cream-300 text-slate-600"
              aria-label="Cerrar menú lateral"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Historial de Conversaciones (HU08 / RF07) */}
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-teal-700" />
              <span>Historial ({conversations.length})</span>
            </span>
          </label>

          {conversations.length === 0 ? (
            <p className="text-[11px] text-slate-500 bg-cream-50 border border-cream-200 rounded-xl p-2.5">
              Tus consultas recientes aparecerán aquí organizadas por fecha y tema.
            </p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
              {conversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                const isEditing = editingId === conv.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      if (!isEditing) {
                        onSelectConversation(conv.id);
                        onCloseMobile?.();
                      }
                    }}
                    className={`group flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                      isActive
                        ? 'bg-white border border-teal-400 text-teal-900 shadow-soft font-semibold'
                        : 'text-slate-700 hover:bg-cream-50 border border-transparent'
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename(conv.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          className="w-full px-2 py-0.5 text-xs bg-white border border-teal-500 rounded"
                        />
                        <button
                          type="button"
                          onClick={() => commitRename(conv.id)}
                          className="p-1 text-teal-700 hover:bg-teal-50 rounded"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <div className="truncate leading-tight">{conv.title}</div>
                          <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                            {formatDateTag(conv.updated_at)} • {conv.message_count} msgs
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onExportConversationPdf(conv.id);
                            }}
                            className="p-1 text-slate-400 hover:text-teal-700 rounded"
                            title="Descargar conversación en PDF"
                          >
                            <FileDown className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => startRename(conv, e)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded"
                            title="Renombrar"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteConversation(conv.id);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Eliminar conversación"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Materia de Consulta / Filtros (RF08) */}
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
            Filtro por régimen normativo
          </label>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => onSelectCategory(null)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                selectedCategory === null
                  ? 'bg-white text-teal-800 border border-cream-300 shadow-soft font-semibold'
                  : 'text-slate-700 hover:bg-cream-200/70 border border-transparent'
              }`}
            >
              <div className="flex items-center space-x-2">
                <BookOpen className="w-3.5 h-3.5 text-teal-700" />
                <span>Toda la normativa</span>
              </div>
              <span className="text-[10px] bg-cream-200 px-1.5 py-0.5 rounded text-slate-600 font-mono">
                Todo
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectCategory('arriendo')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                selectedCategory === 'arriendo'
                  ? 'bg-white text-amber-900 border border-amber-300 shadow-soft font-semibold'
                  : 'text-slate-700 hover:bg-cream-200/70 border border-transparent'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Home className="w-3.5 h-3.5 text-amber-700" />
                <span>Arrendamientos</span>
              </div>
              <span className="text-[10px] bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-amber-800 font-mono">
                Ley 820
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectCategory('propiedad_horizontal')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                selectedCategory === 'propiedad_horizontal'
                  ? 'bg-white text-teal-900 border border-teal-300 shadow-soft font-semibold'
                  : 'text-slate-700 hover:bg-cream-200/70 border border-transparent'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Building2 className="w-3.5 h-3.5 text-teal-700" />
                <span>Propiedad Horizontal</span>
              </div>
              <span className="text-[10px] bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded text-teal-800 font-mono">
                Ley 675
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectCategory('manual_interno')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                selectedCategory === 'manual_interno'
                  ? 'bg-white text-emerald-900 border border-emerald-300 shadow-soft font-semibold'
                  : 'text-slate-700 hover:bg-cream-200/70 border border-transparent'
              }`}
            >
              <div className="flex items-center space-x-2">
                <FileText className="w-3.5 h-3.5 text-emerald-700" />
                <span>Manuales / Mis Archivos</span>
              </div>
              <span className="text-[10px] bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-emerald-800 font-mono">
                Privado
              </span>
            </button>
          </div>
        </div>

        {/* Herramienta Calculadora IPC (HU01) */}
        <button
          type="button"
          onClick={() => {
            onOpenIpc?.();
            onCloseMobile?.();
          }}
          className="w-full p-3 rounded-xl bg-amber-50/90 hover:bg-amber-100/80 border border-amber-200 text-left transition-all shadow-soft group"
        >
          <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
            <Calculator className="w-4 h-4 text-amber-700" />
            <span>Calculadora Legal IPC</span>
          </div>
          <p className="text-[11px] text-amber-900/80 mt-0.5 leading-snug">
            Calcula el aumento máximo legal del canon según IPC DANE y Ley 820 Art. 20.
          </p>
        </button>

        {/* Consultas Habituales */}
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-700" />
            <span>Consultas frecuentes</span>
          </label>
          <div className="space-y-1.5">
            {exampleQueries.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onSelectPrompt(item.prompt, item.category);
                  onCloseMobile?.();
                }}
                className="w-full text-left p-2.5 rounded-xl bg-cream-50 hover:bg-white border border-cream-200/90 hover:border-teal-400 text-xs text-slate-700 transition-all duration-150 group shadow-soft"
              >
                <div className="flex items-center justify-between mb-0.5 gap-2">
                  <span className="font-semibold text-slate-900 group-hover:text-teal-800 line-clamp-1">
                    {item.label}
                  </span>
                  <span className="text-[9px] font-mono text-slate-600 bg-cream-200/80 px-1.5 py-0.5 rounded border border-cream-300 shrink-0">
                    {item.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 line-clamp-2 leading-snug">{item.prompt}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pie Lateral */}
      <div className="pt-3 border-t border-cream-300 text-xs">
        <button
          type="button"
          onClick={() => {
            onOpenAbout?.();
            onCloseMobile?.();
          }}
          className="w-full text-left p-2.5 rounded-xl bg-white border border-cream-300 hover:border-teal-400 text-slate-700 hover:text-teal-800 transition-all shadow-soft"
        >
          <div className="flex items-center space-x-2 text-teal-800 font-semibold text-xs">
            <HelpCircle className="w-3.5 h-3.5 text-teal-700" />
            <span>Sobre LegalProp AI</span>
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex h-full">{sidebarContent}</aside>

      {/* Mobile / Tablet drawer (RNF08 responsive) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-50 h-full animate-fadeIn">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
