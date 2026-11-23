import React, { useState, useEffect } from 'react';
import {
  X,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Trash2,
  LogOut,
  Copy,
  Check,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { apiService } from '../../services/api';
import { RecoveryMethod, SecurityLogItem, UserProfile, UserRole } from '../../types';

export type AuthTab = 'login' | 'register' | 'recovery';

interface AuthModalProps {
  isOpen: boolean;
  initialTab?: AuthTab;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile) => void;
}

const QUESTION_BANK = [
  '¿Cuál es el nombre de tu primera mascota?',
  '¿En qué ciudad naciste?',
  '¿Cómo se llamaba tu colegio de primaria?',
  '¿Cuál es el nombre del barrio donde creciste?',
  '¿Cuál fue tu primer trabajo o universidad?',
  '¿Cuál es el segundo nombre de tu madre o padre?',
  '¿Cuál es tu libro o película favorita de infancia?',
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

  // Pantalla de código de respaldo mostrado una única vez tras registro
  const [createdRecoveryCode, setCreatedRecoveryCode] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Registro (con 3 preguntas distintas)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('inquilino');
  const [q1, setQ1] = useState(QUESTION_BANK[0]);
  const [a1, setA1] = useState('');
  const [q2, setQ2] = useState(QUESTION_BANK[1]);
  const [a2, setA2] = useState('');
  const [q3, setQ3] = useState(QUESTION_BANK[2]);
  const [a3, setA3] = useState('');

  // Recuperación (3 preguntas o código de respaldo)
  const [recEmail, setRecEmail] = useState('');
  const [recStep, setRecStep] = useState<1 | 2>(1);
  const [recQuestions, setRecQuestions] = useState<string[]>([]);
  const [recAnswers, setRecAnswers] = useState<string[]>(['', '', '']);
  const [recMethod, setRecMethod] = useState<RecoveryMethod>('questions');
  const [recCode, setRecCode] = useState('');
  const [recNewPassword, setRecNewPassword] = useState('');
  const [recConfirmPassword, setRecConfirmPassword] = useState('');
  const [rotatedCode, setRotatedCode] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
    setError(null);
    setSuccessMsg(null);
    setCreatedRecoveryCode(null);
    setPendingUser(null);
    setRotatedCode(null);
    setRecStep(1);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !createdRecoveryCode) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, createdRecoveryCode]);

  if (!isOpen) return null;

  const switchTab = (tab: AuthTab) => {
    setActiveTab(tab);
    setError(null);
    setSuccessMsg(null);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
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
    if (regPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (regPassword !== regConfirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (new Set([q1, q2, q3]).size < 3) {
      setError('Elige 3 preguntas de seguridad diferentes.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await apiService.register({
        full_name: regName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        security_questions: [
          { question: q1, answer: a1 },
          { question: q2, answer: a2 },
          { question: q3, answer: a3 },
        ],
        accepted_privacy_policy: true,
      });
      if (res.recovery_code) {
        setCreatedRecoveryCode(res.recovery_code);
        setPendingUser(res.user);
      } else {
        onAuthSuccess(res.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Error al crear la cuenta.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await apiService.getRecoveryQuestions(recEmail);
      setRecQuestions(res.security_questions);
      setRecAnswers(res.security_questions.map(() => ''));
      setRecStep(2);
    } catch (err: any) {
      setError(err.message || 'No encontramos esa cuenta.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (recNewPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (recNewPassword !== recConfirmPassword) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await apiService.resetPassword({
        email: recEmail,
        method: recMethod,
        security_answers: recMethod === 'questions' ? recAnswers : undefined,
        recovery_code: recMethod === 'recovery_code' ? recCode : undefined,
        new_password: recNewPassword,
      });
      setSuccessMsg(res.message);
      setLoginEmail(recEmail);
      if (res.new_recovery_code) {
        setRotatedCode(res.new_recovery_code);
      } else {
        setRecStep(1);
        setTimeout(() => setActiveTab('login'), 1500);
      }
    } catch (err: any) {
      setError(err.message || 'No se pudo restablecer la contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  // Vista posterior al registro: muestra el código maestro una sola vez
  if (createdRecoveryCode && pendingUser) {
    return (
      <div
        className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
        role="dialog"
        aria-modal="true"
      >
        <div className="w-full max-w-md bg-white border border-cream-200 rounded-2xl shadow-elevated p-6 space-y-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800">
              <ShieldCheck className="w-4 h-4" />
              <span>Cuenta creada con éxito</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">Guarda tu código de recuperación</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Además de tus 3 preguntas de seguridad, generamos este código único de respaldo. Guárdalo en un lugar seguro: <strong>no volverá a mostrarse</strong>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-cream-100 border border-cream-300 flex items-center justify-between">
            <code className="text-base font-bold tracking-widest text-slate-900 font-mono">
              {createdRecoveryCode}
            </code>
            <button
              type="button"
              onClick={() => handleCopyCode(createdRecoveryCode)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-cream-300 hover:border-teal-500 text-xs font-medium text-slate-700"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-teal-700" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onAuthSuccess(pendingUser);
              onClose();
            }}
            className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            Ya guardé mi código, continuar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md bg-white border border-cream-200 rounded-2xl shadow-elevated overflow-hidden max-h-[92vh] flex flex-col">
        {/* Cabecera sobria */}
        <div className="px-6 pt-5 pb-4 border-b border-cream-200 flex items-center justify-between">
          <div>
            <h2 id="auth-modal-title" className="text-base font-bold text-slate-900">
              {activeTab === 'login'
                ? 'Iniciar sesión'
                : activeTab === 'register'
                ? 'Crear cuenta'
                : 'Recuperar contraseña'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              LegalProp AI • Espacio privado y cifrado
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-cream-100"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pestañas limpias */}
        <div className="flex border-b border-cream-200 px-6 bg-cream-50/70" role="tablist">
          {[
            { id: 'login' as const, label: 'Entrar' },
            { id: 'register' as const, label: 'Registrarse' },
            { id: 'recovery' as const, label: 'Recuperar' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => switchTab(tab.id)}
              className={`py-2.5 mr-6 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-teal-700 text-teal-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
              {rotatedCode && (
                <div className="p-2.5 bg-white rounded-lg border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Nuevo código de respaldo:</span>
                    <code className="font-mono font-bold text-slate-900">{rotatedCode}</code>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleCopyCode(rotatedCode);
                      setRecStep(1);
                      setActiveTab('login');
                    }}
                    className="px-2.5 py-1 rounded bg-teal-700 text-white text-[11px] font-medium"
                  >
                    Copiar e ir a entrar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="nombre@correo.com"
                  className="w-full px-3.5 py-2.5 bg-cream-50/50 border border-cream-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-teal-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700">Contraseña</label>
                  <button
                    type="button"
                    onClick={() => switchTab('recovery')}
                    className="text-[11px] text-teal-700 hover:underline font-medium"
                  >
                    ¿La olvidaste?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  className="w-full px-3.5 py-2.5 bg-cream-50/50 border border-cream-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-teal-600"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Entrar</span>
              </button>
            </form>
          )}

          {/* TAB 2: REGISTRO CON 3 PREGUNTAS DE SEGURIDAD */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nombre completo</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Ej. Laura Gómez"
                    className="w-full px-3 py-2 bg-cream-50/50 border border-cream-300 rounded-xl text-xs focus:outline-none focus:bg-white focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Correo electrónico</label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="nombre@correo.com"
                    className="w-full px-3 py-2 bg-cream-50/50 border border-cream-300 rounded-xl text-xs focus:outline-none focus:bg-white focus:border-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tu rol</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'inquilino', label: 'Inquilino' },
                      { id: 'propietario', label: 'Propietario' },
                      { id: 'administrador', label: 'Administrador' },
                    ] as const
                  ).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRegRole(r.id)}
                      className={`py-2 px-2 rounded-xl border text-xs font-medium transition-colors ${
                        regRole === r.id
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-white text-slate-700 border-cream-300 hover:border-teal-400'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Contraseña</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Mín. 8 caracteres"
                    className="w-full px-3 py-2 bg-cream-50/50 border border-cream-300 rounded-xl text-xs focus:outline-none focus:bg-white focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Confirmar</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={regConfirm}
                    onChange={(e) => setRegConfirm(e.target.value)}
                    placeholder="Repite contraseña"
                    className="w-full px-3 py-2 bg-cream-50/50 border border-cream-300 rounded-xl text-xs focus:outline-none focus:bg-white focus:border-teal-600"
                  />
                </div>
              </div>

              {/* 3 Preguntas de seguridad */}
              <div className="p-3.5 rounded-xl bg-cream-50 border border-cream-200 space-y-2.5">
                <div className="text-[11px] font-semibold text-slate-800">
                  Verificación en 3 preguntas (para recuperación segura)
                </div>

                {[
                  { num: 1, q: q1, setQ: setQ1, a: a1, setA: setA1 },
                  { num: 2, q: q2, setQ: setQ2, a: a2, setA: setA2 },
                  { num: 3, q: q3, setQ: setQ3, a: a3, setA: setA3 },
                ].map((item) => (
                  <div key={item.num} className="space-y-1">
                    <select
                      value={item.q}
                      onChange={(e) => item.setQ(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-cream-300 rounded-lg text-[11px] text-slate-700 focus:outline-none focus:border-teal-600"
                    >
                      {QUESTION_BANK.map((opt) => (
                        <option key={opt} value={opt}>
                          {item.num}. {opt}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={item.a}
                      onChange={(e) => item.setA(e.target.value)}
                      placeholder={`Respuesta ${item.num}`}
                      className="w-full px-3 py-1.5 bg-white border border-cream-300 rounded-lg text-xs focus:outline-none focus:border-teal-600"
                    />
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Crear cuenta</span>
              </button>
            </form>
          )}

          {/* TAB 3: RECUPERACIÓN (3 PREGUNTAS O CÓDIGO DE RESPALDO) */}
          {activeTab === 'recovery' && (
            <div className="space-y-3.5">
              {recStep === 1 ? (
                <form onSubmit={handleFetchRecovery} className="space-y-3.5">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Ingresa tu correo para validar tus <strong>3 preguntas de seguridad</strong> o tu <strong>código de respaldo</strong>.
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Correo registrado</label>
                    <input
                      type="email"
                      required
                      value={recEmail}
                      onChange={(e) => setRecEmail(e.target.value)}
                      placeholder="nombre@correo.com"
                      className="w-full px-3.5 py-2.5 bg-cream-50/50 border border-cream-300 rounded-xl text-xs focus:outline-none focus:bg-white focus:border-teal-600"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2"
                  >
                    {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Continuar</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-3">
                  {/* Selector de método */}
                  <div className="grid grid-cols-2 gap-1.5 bg-cream-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setRecMethod('questions')}
                      className={`py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                        recMethod === 'questions' ? 'bg-white text-slate-900 shadow-soft' : 'text-slate-600'
                      }`}
                    >
                      3 Preguntas
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecMethod('recovery_code')}
                      className={`py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                        recMethod === 'recovery_code' ? 'bg-white text-slate-900 shadow-soft' : 'text-slate-600'
                      }`}
                    >
                      Código de respaldo
                    </button>
                  </div>

                  {recMethod === 'questions' ? (
                    <div className="space-y-2.5">
                      {recQuestions.map((qText, idx) => (
                        <div key={idx}>
                          <label className="block text-[11px] font-medium text-slate-700 mb-1">
                            {idx + 1}. {qText}
                          </label>
                          <input
                            type="text"
                            required
                            value={recAnswers[idx] || ''}
                            onChange={(e) => {
                              const next = [...recAnswers];
                              next[idx] = e.target.value;
                              setRecAnswers(next);
                            }}
                            placeholder="Tu respuesta"
                            className="w-full px-3 py-2 bg-cream-50/50 border border-cream-300 rounded-xl text-xs focus:outline-none focus:bg-white focus:border-teal-600"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Código maestro de recuperación
                      </label>
                      <input
                        type="text"
                        required
                        value={recCode}
                        onChange={(e) => setRecCode(e.target.value.toUpperCase())}
                        placeholder="LP-XXXX-XXXX"
                        className="w-full px-3 py-2.5 bg-cream-50/50 border border-cream-300 rounded-xl text-xs font-mono tracking-wider focus:outline-none focus:bg-white focus:border-teal-600"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Nueva contraseña</label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={recNewPassword}
                        onChange={(e) => setRecNewPassword(e.target.value)}
                        placeholder="Mín. 8 caracteres"
                        className="w-full px-3 py-2 bg-cream-50/50 border border-cream-300 rounded-xl text-xs focus:outline-none focus:bg-white focus:border-teal-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Confirmar</label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={recConfirmPassword}
                        onChange={(e) => setRecConfirmPassword(e.target.value)}
                        placeholder="Repite contraseña"
                        className="w-full px-3 py-2 bg-cream-50/50 border border-cream-300 rounded-xl text-xs focus:outline-none focus:bg-white focus:border-teal-600"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRecStep(1)}
                      className="px-3 py-2.5 rounded-xl border border-cream-300 text-xs text-slate-600 hover:bg-cream-100"
                    >
                      Volver
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2"
                    >
                      {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Actualizar contraseña</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          <p className="text-[10px] text-slate-400 pt-2 border-t border-cream-200 leading-relaxed">
            Cifrado bcrypt, sesiones JWT y bloqueo temporal automático ante intentos fallidos. Protección de datos conforme a la Ley 1581 de 2012.
          </p>
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
  const [newBackupCode, setNewBackupCode] = useState<string | null>(null);
  const [logs, setLogs] = useState<SecurityLogItem[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    if (!isOpen || !user) return;
    setNewBackupCode(null);
    setStatusMsg(null);
    setConfirmDelete(false);
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const loadLogs = async () => {
    const next = !showLogs;
    setShowLogs(next);
    if (next && logs.length === 0) {
      try {
        const items = await apiService.getSecurityLogs();
        setLogs(items);
      } catch (e: any) {
        setStatusMsg({ type: 'err', text: e.message });
      }
    }
  };

  const handleRotateCode = async () => {
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await apiService.rotateRecoveryCode();
      setNewBackupCode(res.recovery_code);
      setStatusMsg({ type: 'ok', text: res.message });
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    setBusy(true);
    try {
      await apiService.exportMyData();
      setStatusMsg({ type: 'ok', text: 'Copia de datos personales descargada (JSON).' });
    } catch (e: any) {
      setStatusMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
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
      className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-white border border-cream-200 rounded-2xl shadow-elevated overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-cream-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">{user.full_name}</h2>
            <p className="text-xs text-slate-500">
              {user.email} • <span className="capitalize">{user.role}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-cream-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 bg-cream-50 rounded-xl border border-cream-200">
              <div className="text-[10px] text-slate-500">Conversaciones guardadas</div>
              <div className="text-base font-bold text-slate-900 mt-0.5">{user.conversations_count}</div>
            </div>
            <div className="p-3 bg-cream-50 rounded-xl border border-cream-200">
              <div className="text-[10px] text-slate-500">Archivos privados</div>
              <div className="text-base font-bold text-slate-900 mt-0.5">{user.documents_count}</div>
            </div>
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

          {newBackupCode && (
            <div className="p-3 rounded-xl bg-cream-100 border border-cream-300 flex items-center justify-between">
              <code className="font-mono font-bold text-slate-900 tracking-wider">{newBackupCode}</code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(newBackupCode)}
                className="text-[11px] font-semibold text-teal-800 hover:underline"
              >
                Copiar
              </button>
            </div>
          )}

          {/* Seguridad de la cuenta */}
          <div className="space-y-2 border-t border-cream-200 pt-3">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Seguridad y actividad
            </div>

            <button
              type="button"
              onClick={() => setShowPwdForm(!showPwdForm)}
              className="w-full flex items-center justify-between py-2 px-3 rounded-xl hover:bg-cream-50 border border-cream-200 text-slate-700 font-medium"
            >
              <span className="flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5 text-teal-700" />
                Cambiar contraseña
              </span>
            </button>

            {showPwdForm && (
              <form onSubmit={handleChangePwd} className="p-3 bg-cream-50 rounded-xl space-y-2">
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
                  minLength={8}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Nueva contraseña (mín. 8 caracteres)"
                  className="w-full px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-lg"
                >
                  Guardar
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={handleRotateCode}
              disabled={busy}
              className="w-full flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-cream-50 border border-cream-200 text-slate-700 font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5 text-teal-700" />
              <span>Generar nuevo código de recuperación</span>
            </button>

            <button
              type="button"
              onClick={loadLogs}
              className="w-full flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-cream-50 border border-cream-200 text-slate-700 font-medium"
            >
              <Activity className="w-3.5 h-3.5 text-teal-700" />
              <span>{showLogs ? 'Ocultar bitácora de seguridad' : 'Ver actividad reciente (logs sanitizados)'}</span>
            </button>

            {showLogs && (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-cream-200 divide-y divide-cream-200 bg-cream-50/50">
                {logs.length === 0 ? (
                  <p className="p-3 text-[11px] text-slate-500">Sin eventos registrados.</p>
                ) : (
                  logs.map((lg) => (
                    <div key={lg.id} className="px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-800">{lg.action}</span>
                        {lg.details && <p className="text-[10px] text-slate-500 truncate">{lg.details}</p>}
                      </div>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                          lg.status === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {lg.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Privacidad Habeas Data */}
          <div className="space-y-2 border-t border-cream-200 pt-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Privacidad (Ley 1581 de 2012)
              </div>
              <a
                href="/privacidad"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-teal-800 hover:underline"
              >
                Ver política
              </a>
            </div>
            {user.privacy_policy_accepted_at && (
              <div className="text-[11px] text-slate-500">
                Autorización registrada ({user.privacy_policy_version || 'v1.1-2026'}) el{' '}
                {new Date(user.privacy_policy_accepted_at).toLocaleDateString('es-CO')}
              </div>
            )}
            <button
              type="button"
              onClick={handleExport}
              disabled={busy}
              className="w-full flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-cream-50 border border-cream-200 text-slate-700 font-medium"
            >
              <Download className="w-3.5 h-3.5 text-teal-700" />
              <span>Descargar copia de mis datos (JSON)</span>
            </button>

            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-rose-50 border border-rose-200 text-rose-700 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar cuenta y datos definitivamente</span>
              </button>
            ) : (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl space-y-2">
                <p className="text-[11px] text-rose-900">
                  Esta acción elimina permanentemente tu cuenta, chats y archivos. ¿Deseas continuar?
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
                    className="flex-1 py-1.5 bg-rose-600 text-white font-semibold rounded-lg"
                  >
                    Eliminar todo
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
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
