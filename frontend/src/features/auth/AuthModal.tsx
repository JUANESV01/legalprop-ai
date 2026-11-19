import React, { useState, useEffect } from 'react';
import {
  X,
  LogIn,
  UserPlus,
  KeyRound,
  ShieldCheck,
  Mail,
  Lock,
  User,
  Building2,
  Home,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Trash2,
  LogOut,
  HelpCircle,
} from 'lucide-react';
import { apiService } from '../../services/api';
import { UserProfile, UserRole } from '../../types';
import { Logo } from '../../components/Logo';

export type AuthTab = 'login' | 'register' | 'recovery';

interface AuthModalProps {
  isOpen: boolean;
  initialTab?: AuthTab;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile) => void;
}

const SECURITY_QUESTIONS = [
  '¿Cuál es el nombre de tu primera mascota?',
  '¿En qué ciudad naciste?',
  '¿Cuál es el nombre de tu colegio de primaria?',
  '¿Cuál es el segundo nombre de tu madre o padre?',
  '¿Cuál es el nombre del barrio donde creciste?',
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialTab = 'login',
  onClose,
  onAuthSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('inquilino');
  const [regQuestion, setRegQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [regAnswer, setRegAnswer] = useState('');

  // Recovery state (2 pasos gratuitos mediante pregunta de seguridad)
  const [recEmail, setRecEmail] = useState('');
  const [recQuestionFetched, setRecQuestionFetched] = useState<string | null>(null);
  const [recAnswer, setRecAnswer] = useState('');
  const [recNewPassword, setRecNewPassword] = useState('');
  const [recConfirmPassword, setRecConfirmPassword] = useState('');

  useEffect(() => {
    setActiveTab(initialTab);
    setError(null);
    setSuccessMsg(null);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const switchTab = (tab: AuthTab) => {
    setActiveTab(tab);
    setError(null);
    setSuccessMsg(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await apiService.login(loginEmail, loginPassword);
      onAuthSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'No fue posible iniciar sesión.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (regPassword !== regConfirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (regPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await apiService.register({
        full_name: regName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        security_question: regQuestion,
        security_answer: regAnswer,
      });
      onAuthSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al registrar usuario.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchRecoveryQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);
    try {
      const res = await apiService.getRecoveryQuestion(recEmail);
      setRecQuestionFetched(res.security_question);
    } catch (err: any) {
      setError(err.message || 'No encontramos una cuenta con ese correo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (recNewPassword !== recConfirmPassword) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (recNewPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await apiService.resetPassword({
        email: recEmail,
        security_answer: recAnswer,
        new_password: recNewPassword,
      });
      setSuccessMsg(res.message);
      setLoginEmail(recEmail);
      setRecQuestionFetched(null);
      setRecAnswer('');
      setRecNewPassword('');
      setRecConfirmPassword('');
      setTimeout(() => {
        setActiveTab('login');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'No se pudo restablecer la contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  const roles: Array<{ id: UserRole; label: string; desc: string; icon: React.ComponentType<any> }> = [
    { id: 'inquilino', label: 'Inquilino', desc: 'Arrendatario / Residente', icon: Home },
    { id: 'propietario', label: 'Propietario', desc: 'Arrendador / Copropietario', icon: Building2 },
    { id: 'administrador', label: 'Administrador', desc: 'Propiedad Horizontal', icon: Briefcase },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md bg-cream-50 border border-cream-200 rounded-2xl shadow-elevated overflow-hidden max-h-[92vh] flex flex-col">
        {/* Cabecera */}
        <div className="p-5 pb-4 bg-white border-b border-cream-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Logo size="sm" showText={false} />
            <div>
              <h2 id="auth-modal-title" className="text-base font-bold text-slate-900">
                Cuenta LegalProp AI
              </h2>
              <p className="text-[11px] text-slate-500">
                Guarda tus conversaciones y aísla tus documentos privados
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-cream-100 transition-colors"
            aria-label="Cerrar ventana de acceso"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas: Iniciar Sesión / Registrarse / Recuperar */}
        <div
          className="grid grid-cols-3 bg-cream-150 p-1.5 gap-1 border-b border-cream-200"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'login'}
            onClick={() => switchTab('login')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'login'
                ? 'bg-white text-teal-800 shadow-soft border border-cream-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Iniciar Sesión</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'register'}
            onClick={() => switchTab('register')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'register'
                ? 'bg-white text-teal-800 shadow-soft border border-cream-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Registrarse</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'recovery'}
            onClick={() => switchTab('recovery')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'recovery'
                ? 'bg-white text-teal-800 shadow-soft border border-cream-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Recuperar</span>
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-cream-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-cream-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() => switchTab('recovery')}
                  className="text-teal-700 hover:text-teal-900 font-medium underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
                <button
                  type="button"
                  onClick={() => switchTab('register')}
                  className="text-slate-600 hover:text-slate-900"
                >
                  ¿Sin cuenta? <span className="font-semibold text-teal-700">Regístrate</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-soft transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                <span>Ingresar a mi espacio</span>
              </button>
            </form>
          )}

          {/* TAB 2: REGISTRO */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Ej. María Fernanda López"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-cream-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-cream-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              {/* Selector de Rol (RF10) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Perfil jurídico
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {roles.map((r) => {
                    const Icon = r.icon;
                    const active = regRole === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRegRole(r.id)}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          active
                            ? 'bg-teal-50 border-teal-500 text-teal-900 shadow-soft'
                            : 'bg-white border-cream-300 text-slate-600 hover:border-teal-300'
                        }`}
                      >
                        <Icon className={`w-4 h-4 mx-auto mb-1 ${active ? 'text-teal-700' : 'text-slate-400'}`} />
                        <div className="text-[11px] font-bold leading-tight">{r.label}</div>
                        <div className="text-[9px] text-slate-500 leading-tight mt-0.5">{r.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Mín. 6 caracteres"
                    className="w-full px-3 py-2 bg-white border border-cream-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirmar
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regConfirm}
                    onChange={(e) => setRegConfirm(e.target.value)}
                    placeholder="Repite contraseña"
                    className="w-full px-3 py-2 bg-white border border-cream-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              {/* Pregunta de seguridad para recuperación gratuita */}
              <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-200/80 space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-900">
                  <HelpCircle className="w-3.5 h-3.5 text-teal-700" />
                  <span>Pregunta de seguridad (para recuperar tu contraseña)</span>
                </div>
                <select
                  value={regQuestion}
                  onChange={(e) => setRegQuestion(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-cream-300 rounded-lg text-[11px] text-slate-800 focus:outline-none focus:border-teal-600"
                >
                  {SECURITY_QUESTIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={regAnswer}
                  onChange={(e) => setRegAnswer(e.target.value)}
                  placeholder="Tu respuesta secreta (se guarda cifrada)"
                  className="w-full px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-teal-600"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-soft transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                <span>Crear cuenta gratuita</span>
              </button>
            </form>
          )}

          {/* TAB 3: RECUPERACIÓN DE CONTRASEÑA */}
          {activeTab === 'recovery' && (
            <div className="space-y-3.5">
              {!recQuestionFetched ? (
                <form onSubmit={handleFetchRecoveryQuestion} className="space-y-3.5">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Ingresa el correo electrónico de tu cuenta para validar tu pregunta de seguridad y restablecer tu contraseña de inmediato.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Correo registrado
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={recEmail}
                        onChange={(e) => setRecEmail(e.target.value)}
                        placeholder="tu@correo.com"
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-cream-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-soft flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    <span>Continuar recuperación</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-3">
                  <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-xs">
                    <span className="text-[10px] uppercase font-bold text-teal-700 block">
                      Pregunta de seguridad para {recEmail}
                    </span>
                    <p className="font-semibold text-slate-900 mt-1">{recQuestionFetched}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tu respuesta
                    </label>
                    <input
                      type="text"
                      required
                      value={recAnswer}
                      onChange={(e) => setRecAnswer(e.target.value)}
                      placeholder="Ingresa tu respuesta secreta"
                      className="w-full px-3 py-2 bg-white border border-cream-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nueva contraseña
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={recNewPassword}
                        onChange={(e) => setRecNewPassword(e.target.value)}
                        placeholder="Mín. 6 caracteres"
                        className="w-full px-3 py-2 bg-white border border-cream-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Confirmar nueva
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={recConfirmPassword}
                        onChange={(e) => setRecConfirmPassword(e.target.value)}
                        placeholder="Repite contraseña"
                        className="w-full px-3 py-2 bg-white border border-cream-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRecQuestionFetched(null)}
                      className="px-3 py-2.5 rounded-xl border border-cream-300 text-xs text-slate-600 hover:bg-cream-100"
                    >
                      Volver
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-soft flex items-center justify-center gap-2"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      <span>Restablecer contraseña</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Nota de seguridad Habeas Data */}
          <div className="pt-2 border-t border-cream-200 flex items-start gap-2 text-[10px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
            <span>
              Contraseñas cifradas con <strong>bcrypt</strong> y sesiones seguras <strong>JWT</strong>. Cumplimos la Ley 1581 de 2012 (Habeas Data): puedes exportar o eliminar tus datos en cualquier momento.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AccountProfileModalProps {
  isOpen: boolean;
  user: UserProfile | null;
  onClose: () => void;
  onLogout: () => void;
  onAccountDeleted: () => void;
}

export const AccountProfileModal: React.FC<AccountProfileModalProps> = ({
  isOpen,
  user,
  onClose,
  onLogout,
  onAccountDeleted,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [showPwdForm, setShowPwdForm] = useState(false);

  if (!isOpen || !user) return null;

  const roleLabels: Record<string, string> = {
    inquilino: 'Inquilino / Arrendatario',
    propietario: 'Propietario / Arrendador',
    administrador: 'Administrador de Propiedad Horizontal',
  };

  const handleExport = async () => {
    setBusy(true);
    setStatusMsg(null);
    try {
      await apiService.exportMyData();
      setStatusMsg({ type: 'ok', text: 'Tus datos personales fueron descargados (JSON).' });
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    setStatusMsg(null);
    try {
      await apiService.deleteMyAccount();
      onAccountDeleted();
      onClose();
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const handleChangePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await apiService.changePassword(curPwd, newPwd);
      setStatusMsg({ type: 'ok', text: res.message });
      setCurPwd('');
      setNewPwd('');
      setShowPwdForm(false);
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-cream-50 border border-cream-200 rounded-2xl shadow-elevated overflow-hidden">
        <div className="p-5 bg-white border-b border-cream-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">{user.full_name}</h2>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-cream-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 bg-white rounded-xl border border-cream-200 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Rol</div>
              <div className="font-bold text-teal-800 mt-1 capitalize">{user.role}</div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-cream-200 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Chats</div>
              <div className="font-bold text-slate-900 mt-1 text-sm">{user.conversations_count}</div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-cream-200 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Archivos</div>
              <div className="font-bold text-slate-900 mt-1 text-sm">{user.documents_count}</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200 text-teal-900">
            <strong>Perfil activo:</strong> {roleLabels[user.role] || user.role}. Tus documentos cargados están aislados exclusivamente a tu cuenta.
          </div>

          {statusMsg && (
            <div
              className={`p-3 rounded-xl border text-xs ${
                statusMsg.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {statusMsg.text}
            </div>
          )}

          {/* Cambiar contraseña */}
          <div className="border-t border-cream-200 pt-3">
            <button
              type="button"
              onClick={() => setShowPwdForm(!showPwdForm)}
              className="text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{showPwdForm ? 'Ocultar cambio de contraseña' : 'Cambiar mi contraseña'}</span>
            </button>
            {showPwdForm && (
              <form onSubmit={handleChangePwd} className="mt-2.5 space-y-2">
                <input
                  type="password"
                  required
                  value={curPwd}
                  onChange={(e) => setCurPwd(e.target.value)}
                  placeholder="Contraseña actual"
                  className="w-full px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Nueva contraseña (mín. 6 caracteres)"
                  className="w-full px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-lg"
                >
                  Guardar nueva contraseña
                </button>
              </form>
            )}
          </div>

          {/* Derechos Habeas Data (Ley 1581 de 2012 - RNF09) */}
          <div className="border-t border-cream-200 pt-3 space-y-2">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              Privacidad y Habeas Data (Ley 1581 de 2012)
            </span>
            <button
              type="button"
              onClick={handleExport}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white hover:bg-cream-100 border border-cream-300 rounded-xl text-slate-700 font-medium"
            >
              <Download className="w-3.5 h-3.5 text-teal-700" />
              <span>Descargar copia de mis datos (JSON)</span>
            </button>

            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl text-rose-700 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar cuenta y borrar todos mis datos</span>
              </button>
            ) : (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl space-y-2">
                <p className="text-[11px] text-rose-900 font-medium">
                  Esta acción es irreversible y eliminará tu cuenta, historial y archivos privados. ¿Confirmas?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-1.5 bg-white border border-cream-300 rounded-lg text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={busy}
                    className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg"
                  >
                    Sí, eliminar todo
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-cream-200 pt-3">
            <button
              type="button"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
