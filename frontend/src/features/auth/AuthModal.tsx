import React, { useState, useEffect } from 'react';
import {
  X,
  KeyRound,
  Download,
  Trash2,
  LogOut,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { apiService } from '../../services/api';
import { SecurityLogItem, UserProfile } from '../../types';

export type AuthTab = 'login' | 'register' | 'recovery';

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
  const [deletePwd, setDeletePwd] = useState('');
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
    setDeletePwd('');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, user, onClose]);

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

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePwd.trim()) {
      setStatusMsg({ type: 'err', text: 'Ingresa tu contraseña actual para confirmar la eliminación.' });
      return;
    }
    setBusy(true);
    setStatusMsg(null);
    try {
      await apiService.deleteMyAccount(deletePwd);
      setDeletePwd('');
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
      aria-labelledby="profile-modal-title"
    >
      <div className="w-full max-w-md bg-white border border-cream-200 rounded-2xl shadow-elevated overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-cream-200 flex items-center justify-between">
          <div>
            <h2 id="profile-modal-title" className="text-base font-bold text-slate-900">
              {user.full_name}
            </h2>
            <p className="text-xs text-slate-600">
              {user.email} • <span className="capitalize">{user.role}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar perfil de cuenta"
            className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-cream-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 bg-cream-50 rounded-xl border border-cream-200">
              <div className="text-[11px] text-slate-600">Conversaciones guardadas</div>
              <div className="text-base font-bold text-slate-900 mt-0.5">{user.conversations_count}</div>
            </div>
            <div className="p-3 bg-cream-50 rounded-xl border border-cream-200">
              <div className="text-[11px] text-slate-600">Archivos privados</div>
              <div className="text-base font-bold text-slate-900 mt-0.5">{user.documents_count}</div>
            </div>
          </div>

          {statusMsg && (
            <div
              role="status"
              className={`p-3 rounded-xl border text-xs ${
                statusMsg.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
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

          <div className="space-y-2 border-t border-cream-200 pt-3">
            <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              Seguridad y actividad
            </div>

            <button
              type="button"
              onClick={() => setShowPwdForm(!showPwdForm)}
              className="w-full flex items-center justify-between py-2 px-3 rounded-xl hover:bg-cream-50 border border-cream-200 text-slate-800 font-medium"
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
                  aria-label="Contraseña actual"
                  value={curPwd}
                  onChange={(e) => setCurPwd(e.target.value)}
                  placeholder="Contraseña actual"
                  className="w-full px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs text-slate-900"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  aria-label="Nueva contraseña"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Nueva contraseña (mín. 8 caracteres)"
                  className="w-full px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs text-slate-900"
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
              className="w-full flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-cream-50 border border-cream-200 text-slate-800 font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5 text-teal-700" />
              <span>Generar nuevo código de recuperación</span>
            </button>

            <button
              type="button"
              onClick={loadLogs}
              className="w-full flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-cream-50 border border-cream-200 text-slate-800 font-medium"
            >
              <Activity className="w-3.5 h-3.5 text-teal-700" />
              <span>{showLogs ? 'Ocultar bitácora de seguridad' : 'Ver actividad reciente (logs sanitizados)'}</span>
            </button>

            {showLogs && (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-cream-200 divide-y divide-cream-200 bg-cream-50/50">
                {logs.length === 0 ? (
                  <p className="p-3 text-[11px] text-slate-600">Sin eventos registrados.</p>
                ) : (
                  logs.map((lg) => (
                    <div key={lg.id} className="px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900">{lg.action}</span>
                        {lg.details && <p className="text-[10px] text-slate-600 truncate">{lg.details}</p>}
                      </div>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                          lg.status === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-900'
                            : 'bg-rose-50 text-rose-800'
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

          <div className="space-y-2 border-t border-cream-200 pt-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
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
              <div className="text-[11px] text-slate-600">
                Autorización registrada ({user.privacy_policy_version || 'v1.1-2026'}) el{' '}
                {new Date(user.privacy_policy_accepted_at).toLocaleDateString('es-CO')}
              </div>
            )}
            <button
              type="button"
              onClick={handleExport}
              disabled={busy}
              className="w-full flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-cream-50 border border-cream-200 text-slate-800 font-medium"
            >
              <Download className="w-3.5 h-3.5 text-teal-700" />
              <span>Descargar copia de mis datos (JSON)</span>
            </button>

            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-rose-50 border border-rose-200 text-rose-800 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar cuenta y datos definitivamente</span>
              </button>
            ) : (
              <form onSubmit={handleDelete} className="p-3 bg-rose-50 border border-rose-300 rounded-xl space-y-2.5">
                <p className="text-[11px] text-rose-900">
                  Esta acción elimina permanentemente tu cuenta, chats y archivos. Confirma con tu contraseña actual:
                </p>
                <input
                  type="password"
                  required
                  aria-label="Contraseña para confirmar eliminación de cuenta"
                  value={deletePwd}
                  onChange={(e) => setDeletePwd(e.target.value)}
                  placeholder="Tu contraseña actual"
                  className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-xs text-slate-900"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDelete(false);
                      setDeletePwd('');
                    }}
                    className="flex-1 py-1.5 bg-white border border-cream-300 rounded-lg text-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={busy || !deletePwd.trim()}
                    className="flex-1 py-1.5 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white font-semibold rounded-lg"
                  >
                    Eliminar todo
                  </button>
                </div>
              </form>
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
