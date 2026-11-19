import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Shield,
  Database,
  Users,
  Activity,
  RefreshCw,
  Upload,
  LockOpen,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { apiService } from '../../services/api';
import { AdminOverview, AdminUserItem, SecurityLogItem, UserRole } from '../../types';

interface MasterPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenGlobalUploader: () => void;
  onRefreshDocuments: () => void;
}

type MasterTab = 'overview' | 'users' | 'logs';

export const MasterPanelModal: React.FC<MasterPanelModalProps> = ({
  isOpen,
  onClose,
  onOpenGlobalUploader,
  onRefreshDocuments,
}) => {
  const [tab, setTab] = useState<MasterTab>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [logs, setLogs] = useState<SecurityLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [ov, us, lg] = await Promise.all([
        apiService.getAdminOverview(),
        apiService.getAdminUsers(),
        apiService.getAdminAuditLogs(),
      ]);
      setOverview(ov);
      setUsers(us);
      setLogs(lg);
    } catch (e: any) {
      setFeedback({ type: 'err', text: e.message || 'Error cargando datos del Panel Master.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) loadAll();
  }, [isOpen, loadAll]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleReindex = async () => {
    setReindexing(true);
    setFeedback(null);
    try {
      const res = await apiService.reindexAdminDocuments();
      setFeedback({ type: 'ok', text: res.message });
      onRefreshDocuments();
      loadAll();
    } catch (e: any) {
      setFeedback({ type: 'err', text: e.message });
    } finally {
      setReindexing(false);
    }
  };

  const handleRoleChange = async (userId: string, role: UserRole) => {
    try {
      await apiService.updateAdminUser(userId, { role });
      setFeedback({ type: 'ok', text: 'Rol actualizado correctamente.' });
      loadAll();
    } catch (e: any) {
      setFeedback({ type: 'err', text: e.message });
    }
  };

  const handleToggleActive = async (u: AdminUserItem) => {
    try {
      await apiService.updateAdminUser(u.id, { is_active: !u.is_active });
      loadAll();
    } catch (e: any) {
      setFeedback({ type: 'err', text: e.message });
    }
  };

  const handleUnlock = async (userId: string) => {
    try {
      await apiService.updateAdminUser(userId, { unlock: true });
      setFeedback({ type: 'ok', text: 'Cuenta desbloqueada.' });
      loadAll();
    } catch (e: any) {
      setFeedback({ type: 'err', text: e.message });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="master-panel-title"
    >
      <div className="w-full max-w-2xl bg-white border border-cream-200 rounded-2xl shadow-elevated overflow-hidden max-h-[90vh] flex flex-col">
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-cream-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 id="master-panel-title" className="text-base font-bold text-slate-900">
                Panel Administrador Master
              </h2>
              <p className="text-xs text-slate-500">
                Base normativa común, usuarios y auditoría del sistema
              </p>
            </div>
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

        {/* Pestañas */}
        <div className="flex border-b border-cream-200 px-6 bg-cream-50/70">
          {[
            { id: 'overview' as const, label: 'Base común y estado', icon: Database },
            { id: 'users' as const, label: `Usuarios (${users.length})`, icon: Users },
            { id: 'logs' as const, label: 'Auditoría global', icon: Activity },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 py-2.5 mr-6 text-xs font-semibold border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-teal-700 text-teal-800'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Cuerpo */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {feedback && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 ${
                feedback.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {feedback.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {loading && !overview ? (
            <div className="py-10 flex items-center justify-center gap-2 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-teal-700" />
              <span>Cargando información del sistema...</span>
            </div>
          ) : (
            <>
              {tab === 'overview' && overview && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div className="p-3.5 rounded-xl bg-cream-50 border border-cream-200">
                      <div className="text-[10px] uppercase font-semibold text-slate-500">Motor BD</div>
                      <div className="text-sm font-bold text-teal-800 mt-1 uppercase">
                        {overview.database_engine}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-cream-50 border border-cream-200">
                      <div className="text-[10px] uppercase font-semibold text-slate-500">Usuarios</div>
                      <div className="text-sm font-bold text-slate-900 mt-1">{overview.users_count}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-cream-50 border border-cream-200">
                      <div className="text-[10px] uppercase font-semibold text-slate-500">Conversaciones</div>
                      <div className="text-sm font-bold text-slate-900 mt-1">
                        {overview.conversations_count} ({overview.messages_count} msgs)
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-cream-50 border border-cream-200">
                      <div className="text-[10px] uppercase font-semibold text-slate-500">Docs base común</div>
                      <div className="text-sm font-bold text-teal-800 mt-1">
                        {overview.public_documents_count}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-cream-50 border border-cream-200">
                      <div className="text-[10px] uppercase font-semibold text-slate-500">Docs privados</div>
                      <div className="text-sm font-bold text-slate-900 mt-1">
                        {overview.private_documents_count}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-cream-50 border border-cream-200">
                      <div className="text-[10px] uppercase font-semibold text-slate-500">Chunks ChromaDB</div>
                      <div className="text-sm font-bold text-slate-900 mt-1">
                        {overview.vector_store?.total_chunks || 0}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-cream-50 border border-cream-200 space-y-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-xs">
                        Precargar material normativo para todos los usuarios
                      </h3>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        Como Administrador Master puedes subir PDFs, leyes, decretos, sentencias o manuales a la{' '}
                        <strong>base común global</strong>. Quedan guardados en PostgreSQL y disponibles de inmediato para responder preguntas de cualquier usuario.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenGlobalUploader();
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Subir documento a la base común</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleReindex}
                        disabled={reindexing}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-cream-100 border border-cream-300 text-slate-800 font-medium text-xs"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-teal-700 ${reindexing ? 'animate-spin' : ''}`} />
                        <span>{reindexing ? 'Re-indexando...' : 'Re-indexar ChromaDB desde BD'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'users' && (
                <div className="space-y-2">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="p-3 rounded-xl bg-cream-50/70 border border-cream-200 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <span>{u.full_name}</span>
                          {!u.is_active && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                              Inactivo
                            </span>
                          )}
                          {u.is_locked && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              Bloqueado
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {u.email} • {u.conversations_count} chats • {u.documents_count} archivos
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          className="px-2 py-1 bg-white border border-cream-300 rounded-lg text-[11px] text-slate-800"
                        >
                          <option value="inquilino">Inquilino</option>
                          <option value="propietario">Propietario</option>
                          <option value="administrador">Administrador</option>
                          <option value="master">Master</option>
                        </select>

                        {u.is_locked && (
                          <button
                            type="button"
                            onClick={() => handleUnlock(u.id)}
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800"
                            title="Desbloquear cuenta"
                          >
                            <LockOpen className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleToggleActive(u)}
                          className="px-2 py-1 rounded-lg bg-white hover:bg-cream-100 border border-cream-300 text-[11px] text-slate-700"
                        >
                          {u.is_active ? 'Suspender' : 'Activar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'logs' && (
                <div className="rounded-xl border border-cream-200 divide-y divide-cream-200 bg-cream-50/40 max-h-96 overflow-y-auto">
                  {logs.length === 0 ? (
                    <p className="p-4 text-slate-500">No hay eventos registrados todavía.</p>
                  ) : (
                    logs.map((lg) => (
                      <div key={lg.id} className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 text-[11px]">{lg.action}</div>
                          {lg.details && <div className="text-[11px] text-slate-600 truncate">{lg.details}</div>}
                          <div className="text-[10px] text-slate-400 font-mono">
                            {new Date(lg.created_at).toLocaleString('es-CO')}
                            {lg.ip_hash ? ` • ip:${lg.ip_hash.slice(0, 8)}` : ''}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded shrink-0 ${
                            lg.status === 'SUCCESS'
                              ? 'bg-emerald-50 text-emerald-800'
                              : lg.status === 'BLOCKED'
                              ? 'bg-amber-50 text-amber-800'
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};
