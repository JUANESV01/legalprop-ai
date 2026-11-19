import React from 'react';
import { Logo } from './Logo';
import {
  FileUp,
  Info,
  Calculator,
  LogIn,
  UserPlus,
  UserCheck,
  Menu,
} from 'lucide-react';
import { BackendHealthResponse, UserProfile } from '../types';
import { AuthTab } from '../features/auth/AuthModal';

interface HeaderProps {
  health: BackendHealthResponse | null;
  user: UserProfile | null;
  userDocsCount: number;
  onOpenDocuments: () => void;
  onOpenAbout: () => void;
  onOpenIpc: () => void;
  onOpenAuth: (tab: AuthTab) => void;
  onOpenProfile: () => void;
  onToggleMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  user,
  userDocsCount,
  onOpenDocuments,
  onOpenAbout,
  onOpenIpc,
  onOpenAuth,
  onOpenProfile,
  onToggleMobileMenu,
}) => {
  const isHealthy = health?.status === 'healthy';

  return (
    <header className="h-16 border-b border-cream-200 bg-cream-50/95 backdrop-blur-sm px-3 sm:px-5 flex items-center justify-between sticky top-0 z-30 transition-colors shadow-soft">
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-cream-200/70"
          aria-label="Abrir menú lateral"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Logo size="md" showText={true} />

        <div className="hidden xl:block h-5 w-px bg-cream-300" />
        <div className="hidden xl:flex items-center space-x-2 text-xs bg-teal-50/90 border border-teal-200 px-2.5 py-1 rounded-lg">
          <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-teal-600' : 'bg-amber-500'}`} />
          <span className="text-teal-900 font-medium text-[11px]">
            {isHealthy ? 'RAG + Web activo' : 'Conectando...'}
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-1.5 sm:space-x-2">
        {/* Calculadora IPC (HU01) */}
        <button
          type="button"
          onClick={onOpenIpc}
          className="flex items-center space-x-1.5 text-xs font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1.5 rounded-lg transition-colors"
          title="Calculadora de incremento legal de arriendo (IPC)"
        >
          <Calculator className="w-3.5 h-3.5 text-amber-700" />
          <span className="hidden md:inline">IPC</span>
        </button>

        {/* Botón Gestor Documental */}
        <button
          type="button"
          onClick={onOpenDocuments}
          className="flex items-center space-x-1.5 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white px-2.5 sm:px-3 py-1.5 rounded-lg shadow-soft transition-all duration-150 active:scale-95"
          title="Cargar o consultar normativas y reglamentos (PDF, DOCX, TXT)"
        >
          <FileUp className="w-3.5 h-3.5 text-white stroke-[2.2]" />
          <span className="hidden sm:inline">Documentos</span>
          {userDocsCount > 0 && (
            <span className="text-[10px] font-mono bg-white/20 px-1.5 py-0.2 rounded-full">
              {userDocsCount}
            </span>
          )}
        </button>

        {/* Pestañas / Botones de Autenticación: Login y Registro (o Perfil de Usuario) */}
        {user ? (
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex items-center space-x-2 text-xs bg-white hover:bg-cream-100 border border-teal-300 px-2.5 py-1.5 rounded-lg shadow-soft transition-colors"
            title="Ver perfil, rol y privacidad Habeas Data"
          >
            <div className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center text-[10px] font-bold">
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:flex flex-col text-left leading-none">
              <span className="font-bold text-slate-900 text-[11px] max-w-[110px] truncate">
                {user.full_name}
              </span>
              <span className="text-[9px] text-teal-700 capitalize font-medium">{user.role}</span>
            </div>
            <UserCheck className="w-3.5 h-3.5 text-teal-700 sm:hidden" />
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="flex items-center space-x-1.5 text-xs font-semibold text-teal-800 bg-white hover:bg-teal-50 border border-teal-300 px-2.5 py-1.5 rounded-lg transition-colors shadow-soft"
              title="Iniciar sesión o recuperar contraseña"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Iniciar Sesión</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="flex items-center space-x-1.5 text-xs font-semibold text-slate-800 bg-cream-100 hover:bg-cream-200 border border-cream-300 px-2.5 py-1.5 rounded-lg transition-colors"
              title="Crear una cuenta nueva"
            >
              <UserPlus className="w-3.5 h-3.5 text-teal-700" />
              <span className="hidden md:inline">Registrarse</span>
            </button>
          </div>
        )}

        {/* Botón Acerca del Proyecto */}
        <button
          type="button"
          onClick={onOpenAbout}
          className="hidden sm:flex items-center space-x-1 text-xs text-slate-700 hover:text-slate-900 bg-cream-100 hover:bg-cream-200 border border-cream-300 p-1.5 sm:px-2.5 rounded-lg transition-colors font-medium"
          title="Información sobre LegalProp AI y marco normativo"
          aria-label="Acerca de LegalProp AI"
        >
          <Info className="w-3.5 h-3.5 text-teal-700" />
        </button>
      </div>
    </header>
  );
};
