import React, { useState } from 'react';
import {
  Plus,
  MessageSquare,
  Trash2,
  Pencil,
  Check,
  X,
  FileDown,
  Info,
  LogIn,
  UserPlus,
  ChevronRight,
  SlidersHorizontal,
  Calculator,
  FolderOpen,
} from 'lucide-react';
import { ConversationSummary, UserProfile } from '../types';
import { AuthTab } from '../features/auth/AuthModal';

interface SidebarProps {
  isOpen: boolean;
  onCloseMobile: () => void;
  selectedCategory: 'arriendo' | 'propiedad_horizontal' | 'manual_interno' | null;
  onSelectCategory: (cat: 'arriendo' | 'propiedad_horizontal' | 'manual_interno' | null) => void;
  conversations: ConversationSummary[];
  activeConversationId?: string;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
  onExportConversationPdf: (id: string) => Promise<void>;
  user: UserProfile | null;
  onOpenAuth: (tab: AuthTab) => void;
  onOpenProfile: () => void;
  onOpenAbout: () => void;
  onOpenDocuments: () => void;
  onOpenIpc: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onCloseMobile,
  selectedCategory,
  onSelectCategory,
  conversations,
  activeConversationId,
  onNewConversation,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onExportConversationPdf,
  user,
  onOpenAuth,
  onOpenProfile,
  onOpenAbout,
  onOpenDocuments,
  onOpenIpc,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const commitRename = async (id: string) => {
    if (editTitle.trim()) {
      await onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const categories: Array<{
    id: 'arriendo' | 'propiedad_horizontal' | 'manual_interno' | null;
    label: string;
  }> = [
    { id: null, label: 'Toda la normativa' },
    { id: 'arriendo', label: 'Arrendamientos (Ley 820)' },
    { id: 'propiedad_horizontal', label: 'Propiedad Horizontal (Ley 675)' },
    { id: 'manual_interno', label: 'Mis documentos cargados' },
  ];

  const innerContent = (
    <div className="w-72 h-full bg-cream-150 border-r border-cream-200 flex flex-col justify-between select-none">
      {/* Parte superior: Nueva consulta */}
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              onNewConversation();
              onCloseMobile();
            }}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-cream-50 border border-cream-300 text-slate-800 text-xs font-semibold shadow-soft transition-colors"
          >
            <Plus className="w-4 h-4 text-teal-700" />
            <span>Nueva consulta</span>
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-cream-200"
            aria-label="Cerrar panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filtro de materia plegable (limpio y discreto) */}
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-600 hover:bg-cream-200/70 transition-colors"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span>
              Enfoque:{' '}
              <strong className="text-slate-800">
                {categories.find((c) => c.id === selectedCategory)?.label.split(' ')[0]}
              </strong>
            </span>
          </span>
          <ChevronRight
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showFilters ? 'rotate-90' : ''}`}
          />
        </button>

        {showFilters && (
          <div className="px-1 space-y-0.5 animate-fadeIn">
            {categories.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => {
                    onSelectCategory(cat.id);
                    setShowFilters(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] transition-colors ${
                    active
                      ? 'bg-teal-700 text-white font-medium'
                      : 'text-slate-600 hover:bg-cream-200/70 hover:text-slate-900'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Centro desplazable: Conversaciones recientes */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
        <div className="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Recientes
        </div>

        {conversations.length === 0 ? (
          <p className="px-2 py-3 text-[11px] text-slate-500 leading-relaxed">
            Aquí verás tu historial de consultas para retomarlas cuando quieras.
          </p>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isEditing = editingId === conv.id;

            return (
              <div
                key={conv.id}
                onClick={() => {
                  if (!isEditing) {
                    onSelectConversation(conv.id);
                    onCloseMobile();
                  }
                }}
                className={`group flex items-center justify-between gap-1 px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-cream-200/90 text-slate-950 font-medium'
                    : 'text-slate-700 hover:bg-cream-200/50'
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
                      className="w-full px-2 py-0.5 text-xs bg-white border border-teal-600 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => commitRename(conv.id)}
                      className="p-1 text-teal-700"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{conv.title}</span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onExportConversationPdf(conv.id);
                        }}
                        className="p-1 text-slate-500 hover:text-teal-800 rounded"
                        title="Descargar PDF"
                      >
                        <FileDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(conv.id);
                          setEditTitle(conv.title);
                        }}
                        className="p-1 text-slate-500 hover:text-slate-900 rounded"
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
                        className="p-1 text-slate-500 hover:text-rose-600 rounded"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pie fijo izquierdo: Herramientas, Sobre el proyecto y Cuenta/Login */}
      <div className="p-3 border-t border-cream-200 space-y-1 bg-cream-150">
        <button
          type="button"
          onClick={() => {
            onOpenDocuments();
            onCloseMobile();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-700 hover:bg-cream-200/70 hover:text-slate-950 transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
          <span>Mis documentos</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenIpc();
            onCloseMobile();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-700 hover:bg-cream-200/70 hover:text-slate-950 transition-colors"
        >
          <Calculator className="w-3.5 h-3.5 text-slate-500" />
          <span>Calculadora IPC</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenAbout();
            onCloseMobile();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-700 hover:bg-cream-200/70 hover:text-slate-950 transition-colors"
        >
          <Info className="w-3.5 h-3.5 text-slate-500" />
          <span>Sobre el proyecto</span>
        </button>

        {/* Bloque de Cuenta / Login en la parte inferior izquierda */}
        <div className="pt-2 mt-1 border-t border-cream-200">
          {user ? (
            <button
              type="button"
              onClick={() => {
                onOpenProfile();
                onCloseMobile();
              }}
              className="w-full flex items-center justify-between gap-2 p-2 rounded-xl bg-white hover:bg-cream-50 border border-cream-300/90 transition-colors text-left"
              title="Gestionar cuenta, seguridad y privacidad"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-teal-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 truncate">{user.full_name}</div>
                  <div className="text-[10px] text-slate-500 capitalize truncate">
                    {user.role} • Seguridad y logs
                  </div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
          ) : (
            <div className="p-2.5 rounded-xl bg-white border border-cream-300/90 space-y-2">
              <div className="text-[11px] text-slate-600 leading-snug">
                Inicia sesión para guardar tu historial y aislar tus archivos.
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onOpenAuth('login');
                    onCloseMobile();
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-[11px] font-semibold transition-colors"
                >
                  <LogIn className="w-3 h-3" />
                  <span>Entrar</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenAuth('register');
                    onCloseMobile();
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-cream-100 hover:bg-cream-200 border border-cream-300 text-slate-800 text-[11px] font-semibold transition-colors"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>Registro</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Escritorio: panel desplegable suavemente */}
      <aside
        className={`hidden lg:block h-full overflow-hidden transition-all duration-200 ease-out shrink-0 ${
          isOpen ? 'w-72 opacity-100' : 'w-0 opacity-0'
        }`}
        aria-hidden={!isOpen}
      >
        {innerContent}
      </aside>

      {/* Móvil / Tableta: cajón deslizable */}
      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-xs" onClick={onCloseMobile} />
          <div className="relative z-50 h-full animate-fadeIn">{innerContent}</div>
        </div>
      )}
    </>
  );
};
