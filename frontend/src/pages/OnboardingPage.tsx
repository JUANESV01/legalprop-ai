import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  FileText,
  Lock,
  MessageSquare,
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { apiService } from '../services/api';
import { RecoveryMethod, UserProfile, UserRole } from '../types';

export type OnboardingTab = 'login' | 'register' | 'recovery';

interface OnboardingPageProps {
  initialTab: OnboardingTab;
  onAuthSuccess: (user: UserProfile) => void;
  onNavigate: (path: string) => void;
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

export const OnboardingPage: React.FC<OnboardingPageProps> = ({
  initialTab,
  onAuthSuccess,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<OnboardingTab>(initialTab);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [createdRecoveryCode, setCreatedRecoveryCode] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Registro
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
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  // Recuperación
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
  }, [initialTab]);

  const switchTab = (tab: OnboardingTab) => {
    setActiveTab(tab);
    setError(null);
    setSuccessMsg(null);
    const suffix = tab === 'login' ? '' : `?tab=${tab}`;
    window.history.replaceState(null, '', `/login${suffix}`);
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
      onNavigate('/chat/new');
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
    if (!acceptedPrivacy) {
      setError('Debes aceptar los Términos de Uso y la Política de Tratamiento de Datos de RTK Solutions.');
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
        accepted_privacy_policy: acceptedPrivacy,
      });
      if (res.recovery_code) {
        setCreatedRecoveryCode(res.recovery_code);
        setPendingUser(res.user);
      } else {
        onAuthSuccess(res.user);
        onNavigate('/onboarding');
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
        setTimeout(() => switchTab('login'), 1500);
      }
    } catch (err: any) {
      setError(err.message || 'No se pudo restablecer la contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-100 text-slate-800 flex flex-col lg:flex-row font-sans">
      {/* Columna izquierda editorial */}
      <div className="lg:w-[44%] bg-cream-150 border-b lg:border-b-0 lg:border-r border-cream-200 p-6 sm:p-10 lg:p-14 flex flex-col justify-between gap-8">
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="text-left focus:outline-none"
            >
              <Logo size="sm" showText={true} />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-950 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Inicio</span>
            </button>
          </div>

          <div className="space-y-3 max-w-md">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 font-display leading-tight">
              Tu espacio jurídico privado, siempre a mano.
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Inicia sesión o crea tu cuenta para conservar tu historial de consultas y subir reglamentos o contratos visibles únicamente para ti.
            </p>
          </div>

          <div className="space-y-3.5 max-w-md text-xs text-slate-700">
            <div className="flex items-start gap-3">
              <MessageSquare className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <span>Retoma conversaciones pasadas con enlace directo (`/chat/id`) y expórtalas a PDF.</span>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <span>Sube tus propios PDFs, Word o TXT aislados exclusivamente en tu cuenta.</span>
            </div>
            <div className="flex items-start gap-3">
              <Lock className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <span>Seguridad con bcrypt, JWT, 3 preguntas de recuperación y derechos Habeas Data.</span>
            </div>
          </div>
        </div>

        <div className="hidden lg:block text-[11px] text-slate-500">
          LegalProp AI • Ley 820 de 2003 y Ley 675 de 2001 (Colombia)
        </div>
      </div>

      {/* Columna derecha: Formulario */}
      <div className="flex-1 flex flex-col items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md space-y-4">
          {createdRecoveryCode && pendingUser ? (
            <div className="bg-white border border-cream-200 rounded-2xl shadow-card p-6 sm:p-7 space-y-5">
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
                  onNavigate('/onboarding');
                }}
                className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                Ya guardé mi código, continuar
              </button>
            </div>
          ) : (
            <div className="bg-white border border-cream-200 rounded-2xl shadow-card overflow-hidden">
              {/* Pestañas */}
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
                    className={`py-3 mr-6 text-xs font-semibold border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-teal-700 text-teal-800'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-6 space-y-4">
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
                            switchTab('login');
                          }}
                          className="px-2.5 py-1 rounded bg-teal-700 text-white text-[11px] font-medium"
                        >
                          Copiar e ir a entrar
                        </button>
                      </div>
                    )}
                  </div>
                )}

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
                      <span>Entrar al chat</span>
                    </button>
                  </form>
                )}

                {activeTab === 'register' && (
                  <form onSubmit={handleRegister} className="space-y-3">
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

                    <div className="p-3 rounded-xl bg-cream-50 border border-cream-200 space-y-2">
                      <div className="text-[11px] font-semibold text-slate-800">
                        Verificación en 3 preguntas (recuperación segura)
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
                            className="w-full px-2.5 py-1.5 bg-white border border-cream-300 rounded-lg text-[11px] text-slate-700"
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
                            className="w-full px-3 py-1.5 bg-white border border-cream-300 rounded-lg text-xs"
                          />
                        </div>
                      ))}
                    </div>

                    <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-cream-50/80 border border-cream-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acceptedPrivacy}
                        onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                        className="mt-0.5 rounded border-cream-300 text-teal-700 focus:ring-teal-600"
                      />
                      <span className="text-[11px] text-slate-600 leading-relaxed">
                        Acepto los Términos de Uso de <strong>RTK Solutions</strong> y autorizo el tratamiento de mis datos y el procesamiento de mis documentos mediante IA conforme a la{' '}
                        <a
                          href="/privacidad"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-800 font-semibold underline hover:text-teal-950"
                        >
                          Política de Datos y TyC (Ley 1581 de 2012)
                        </a>
                        .
                      </span>
                    </label>

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
                        <div className="grid grid-cols-2 gap-1.5 bg-cream-100 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => setRecMethod('questions')}
                            className={`py-1.5 rounded-lg text-[11px] font-semibold ${
                              recMethod === 'questions' ? 'bg-white text-slate-900 shadow-soft' : 'text-slate-600'
                            }`}
                          >
                            3 Preguntas
                          </button>
                          <button
                            type="button"
                            onClick={() => setRecMethod('recovery_code')}
                            className={`py-1.5 rounded-lg text-[11px] font-semibold ${
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
                              className="w-full px-3 py-2.5 bg-cream-50/50 border border-cream-300 rounded-xl text-xs font-mono tracking-wider"
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
                              className="w-full px-3 py-2 bg-cream-50/50 border border-cream-300 rounded-xl text-xs"
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
                              className="w-full px-3 py-2 bg-cream-50/50 border border-cream-300 rounded-xl text-xs"
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
              </div>
            </div>
          )}

          {!createdRecoveryCode && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => onNavigate('/chat/new')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-teal-800 transition-colors"
              >
                <span>Continuar al chat sin iniciar sesión</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
