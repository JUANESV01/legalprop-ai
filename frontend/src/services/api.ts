import {
  AdminOverview,
  AdminUserItem,
  AuthResponse,
  BackendHealthResponse,
  ChatQueryRequest,
  ChatQueryResponse,
  Citation,
  ConversationDetail,
  ConversationSummary,
  DisambiguationInfo,
  DocumentListResponse,
  DocumentSummary,
  DocumentUploadResponse,
  IPCCalcRequest,
  IPCCalcResponse,
  RecoveryMethod,
  SecurityLogItem,
  SecurityQuestionItem,
  UserProfile,
  UserRole,
} from '../types';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '/api/v1' : 'http://localhost:8000/api/v1');

const TOKEN_KEY = 'legalprop_access_token';
const GUEST_SESSION_KEY = 'legalprop_guest_session_id';

let unauthorizedCallback: (() => void) | null = null;

export function setOnUnauthorized(cb: (() => void) | null): void {
  unauthorizedCallback = cb;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export const PRIVACY_POLICY_VERSION = 'v1.1-2026';
const GUEST_CONSENT_KEY = 'legalprop_guest_privacy_consent';

function secureRandomId(): string {
  // El ID de invitado es lo único que protege sus chats y documentos: debe ser impredecible.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getOrCreateGuestSessionId(): string {
  // Limpiar cualquier ID antiguo persistido en localStorage
  localStorage.removeItem(GUEST_SESSION_KEY);
  // sessionStorage sobrevive a recargas (F5) en la misma pestaña, pero se borra al cerrar la pestaña
  let id = sessionStorage.getItem(GUEST_SESSION_KEY);
  if (!id || !/^gs_[a-f0-9]{32}$/.test(id)) {
    id = `gs_${secureRandomId()}`;
    sessionStorage.setItem(GUEST_SESSION_KEY, id);
  }
  return id;
}

export function hasGuestConsent(): boolean {
  return sessionStorage.getItem(GUEST_CONSENT_KEY) === PRIVACY_POLICY_VERSION;
}

export function setGuestConsent(accepted: boolean): void {
  if (accepted) sessionStorage.setItem(GUEST_CONSENT_KEY, PRIVACY_POLICY_VERSION);
  else sessionStorage.removeItem(GUEST_CONSENT_KEY);
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Guest-Session': getOrCreateGuestSessionId(),
    ...(extra || {}),
  };
  if (hasGuestConsent()) headers['X-Privacy-Consent'] = PRIVACY_POLICY_VERSION;
  const token = getStoredToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function parseError(response: Response, fallbackMsg: string): Promise<Error> {
  if (response.status === 401 && getStoredToken()) {
    setStoredToken(null);
    unauthorizedCallback?.();
  }
  const errData = await response.json().catch(() => null);
  const detail = errData?.detail || fallbackMsg || `Error ${response.status}`;
  return new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
}

export interface StreamChatCallbacks {
  onMetadata?: (meta: {
    conversation_id: string;
    conversation_title: string;
    category_detected?: string;
    citations: Citation[];
    user_documents_used?: boolean;
    web_fallback_used?: boolean;
    is_draft_document?: boolean;
    disambiguation?: DisambiguationInfo | null;
  }) => void;
  onToken?: (text: string) => void;
  onProvider?: (info: {
    provider_requested?: string;
    provider_used?: string;
    model_used?: string;
    fallback_used?: boolean;
    fallback_reason?: string;
  }) => void;
  onWebSources?: (citations: Citation[]) => void;
  onDone?: (info: {
    message_id: string;
    conversation_id: string;
    conversation_title: string;
    ttft_ms?: number;
    total_ms?: number;
    provider_used?: string;
    model_used?: string;
    fallback_used?: boolean;
  }) => void;
  onError?: (detail: string) => void;
}

export const apiService = {
  async checkHealth(): Promise<BackendHealthResponse> {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) throw await parseError(response, 'Error en health check');
    return response.json();
  },

  // --- AUTENTICACIÓN, SEGURIDAD Y HABEAS DATA ---
  async register(payload: {
    full_name: string;
    email: string;
    password: string;
    role: UserRole;
    security_questions: SecurityQuestionItem[];
    accepted_privacy_policy: boolean;
  }): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw await parseError(response, 'No se pudo completar el registro');
    const data: AuthResponse = await response.json();
    setStoredToken(data.access_token);
    return data;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) throw await parseError(response, 'Credenciales inválidas');
    const data: AuthResponse = await response.json();
    setStoredToken(data.access_token);
    return data;
  },

  async getMe(): Promise<UserProfile> {
    const response = await fetch(`${API_BASE_URL}/auth/me`, { headers: buildHeaders() });
    if (!response.ok) throw await parseError(response, 'Sesión expirada');
    return response.json();
  },

  async getSecurityLogs(): Promise<SecurityLogItem[]> {
    const response = await fetch(`${API_BASE_URL}/auth/security-logs`, { headers: buildHeaders() });
    if (!response.ok) throw await parseError(response, 'No se pudieron consultar los registros');
    return response.json();
  },

  async getRecoveryQuestions(
    email: string
  ): Promise<{ email: string; security_questions: string[]; supports_recovery_code: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/recovery-question`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email }),
    });
    if (!response.ok) throw await parseError(response, 'No se encontró la cuenta');
    return response.json();
  },

  async resetPassword(payload: {
    email: string;
    method: RecoveryMethod;
    security_answers?: string[];
    recovery_code?: string;
    new_password: string;
  }): Promise<{ status: string; message: string; new_recovery_code?: string | null }> {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw await parseError(response, 'No se pudo restablecer la contraseña');
    return response.json();
  },

  async changePassword(
    current_password: string,
    new_password: string
  ): Promise<{ status: string; message: string; access_token?: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ current_password, new_password }),
    });
    if (!response.ok) throw await parseError(response, 'Error al cambiar contraseña');
    const data = await response.json();
    if (data?.access_token) {
      setStoredToken(data.access_token);
    }
    return data;
  },

  async migrateGuestSession(): Promise<{
    status: string;
    migrated_conversations: number;
    migrated_documents: number;
  }> {
    const response = await fetch(`${API_BASE_URL}/auth/migrate-guest`, {
      method: 'POST',
      headers: buildHeaders(),
    });
    if (!response.ok) throw await parseError(response, 'No se pudo migrar el historial temporal');
    return response.json();
  },

  async rotateRecoveryCode(): Promise<{ status: string; recovery_code: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/rotate-recovery-code`, {
      method: 'POST',
      headers: buildHeaders(),
    });
    if (!response.ok) throw await parseError(response, 'Error regenerando código de respaldo');
    return response.json();
  },

  async exportMyData(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/export-data`, { headers: buildHeaders() });
    if (!response.ok) throw await parseError(response, 'Error al exportar datos');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'legalprop_mis_datos_habeas_data.json';
    a.click();
    URL.revokeObjectURL(url);
  },

  async deleteMyAccount(password: string): Promise<{ status: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'DELETE',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ password }),
    });
    if (!response.ok) throw await parseError(response, 'Error al eliminar la cuenta');
    const data = await response.json();
    setStoredToken(null);
    return data;
  },

  logout(): void {
    setStoredToken(null);
  },

  // --- CHAT & STREAMING SSE ---
  async queryChat(request: ChatQueryRequest): Promise<ChatQueryResponse> {
    const response = await fetch(`${API_BASE_URL}/chat/query`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(request),
    });
    if (!response.ok) throw await parseError(response, 'Error al procesar consulta');
    return response.json();
  },

  async streamChat(
    request: ChatQueryRequest,
    callbacks: StreamChatCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json', Accept: 'text/event-stream' }),
      body: JSON.stringify(request),
      signal,
    });
    if (!response.ok || !response.body) {
      throw await parseError(response, 'Error al conectar la respuesta en tiempo real');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    const onAbort = () => {
      reader.cancel().catch(() => {});
    };
    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    const processEventBlock = (block: string) => {
      const lines = block.split('\n');
      let eventName = 'message';
      const dataLines: string[] = [];

      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');
        if (line.startsWith('event:')) eventName = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }

      if (dataLines.length === 0) return;
      try {
        const parsed = JSON.parse(dataLines.join('\n'));
        if (eventName === 'metadata') callbacks.onMetadata?.(parsed);
        else if (eventName === 'provider') callbacks.onProvider?.(parsed);
        else if (eventName === 'token') callbacks.onToken?.(parsed.text || '');
        else if (eventName === 'web_sources') callbacks.onWebSources?.(parsed.citations || []);
        else if (eventName === 'done') callbacks.onDone?.(parsed);
        else if (eventName === 'error') callbacks.onError?.(parsed.detail || 'Error de generación');
      } catch (e) {
        console.warn('Error parseando evento SSE:', e);
      }
    };

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          if (part.trim()) processEventBlock(part);
        }
      }
      if (buffer.trim()) processEventBlock(buffer);
    } finally {
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  },

  // --- CONVERSACIONES CRUD ---
  async listConversations(): Promise<ConversationSummary[]> {
    const response = await fetch(`${API_BASE_URL}/conversations`, { headers: buildHeaders() });
    if (!response.ok) throw await parseError(response, 'Error cargando historial');
    return response.json();
  },

  async getConversation(conversationId: string): Promise<ConversationDetail> {
    const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
      headers: buildHeaders(),
    });
    if (!response.ok) throw await parseError(response, 'Error cargando conversación');
    return response.json();
  },

  async renameConversation(conversationId: string, title: string): Promise<ConversationSummary> {
    const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ title }),
    });
    if (!response.ok) throw await parseError(response, 'Error renombrando conversación');
    return response.json();
  },

  async deleteConversation(conversationId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    if (!response.ok) throw await parseError(response, 'Error eliminando conversación');
  },

  async downloadConversationPdf(conversationId: string, filename?: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/pdf`, {
      headers: buildHeaders(),
    });
    if (!response.ok) throw await parseError(response, 'No se pudo generar el PDF');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `constancia_legalprop_${conversationId.slice(0, 8)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // --- DOCUMENTOS ---
  async listDocuments(): Promise<DocumentListResponse> {
    const response = await fetch(`${API_BASE_URL}/documents`, { headers: buildHeaders() });
    if (!response.ok) throw await parseError(response, 'Error listando documentos');
    return response.json();
  },

  async uploadDocument(
    file: File,
    category: string,
    title?: string,
    isPublic: boolean = false
  ): Promise<DocumentUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    if (title) formData.append('title', title);
    if (isPublic) formData.append('is_public', 'true');

    const response = await fetch(`${API_BASE_URL}/documents/upload`, {
      method: 'POST',
      headers: buildHeaders(),
      body: formData,
    });
    if (!response.ok) throw await parseError(response, 'Fallo en la ingesta del archivo');
    return response.json();
  },

  async updateDocumentMaster(
    docId: string,
    payload: { title?: string; category?: string; is_public?: boolean }
  ): Promise<DocumentSummary> {
    const response = await fetch(`${API_BASE_URL}/documents/${docId}`, {
      method: 'PATCH',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw await parseError(response, 'No se pudo actualizar el documento');
    return response.json();
  },

  async deleteDocument(docId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/documents/${docId}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    if (!response.ok) throw await parseError(response, 'Error eliminando documento');
  },

  // --- PANEL ADMINISTRADOR MASTER ---
  async getAdminOverview(): Promise<AdminOverview> {
    const response = await fetch(`${API_BASE_URL}/admin/overview`, { headers: buildHeaders() });
    if (!response.ok) throw await parseError(response, 'Error cargando panel Master');
    return response.json();
  },

  async getAdminUsers(): Promise<AdminUserItem[]> {
    const response = await fetch(`${API_BASE_URL}/admin/users`, { headers: buildHeaders() });
    if (!response.ok) throw await parseError(response, 'Error listando usuarios');
    return response.json();
  },

  async updateAdminUser(
    userId: string,
    payload: { role?: UserRole; is_active?: boolean; unlock?: boolean }
  ): Promise<AdminUserItem> {
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      method: 'PATCH',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw await parseError(response, 'Error actualizando usuario');
    return response.json();
  },

  async getAdminAuditLogs(): Promise<SecurityLogItem[]> {
    const response = await fetch(`${API_BASE_URL}/admin/audit-logs`, { headers: buildHeaders() });
    if (!response.ok) throw await parseError(response, 'Error cargando auditoría');
    return response.json();
  },

  async reindexAdminDocuments(): Promise<{ status: string; reindexed_documents: number; total_chunks: number; message: string }> {
    const response = await fetch(`${API_BASE_URL}/admin/reindex`, {
      method: 'POST',
      headers: buildHeaders(),
    });
    if (!response.ok) throw await parseError(response, 'Error re-indexando documentos');
    return response.json();
  },

  // --- CALCULADORA IPC & REPORTES PDF ---
  async calculateIpc(payload: IPCCalcRequest): Promise<IPCCalcResponse> {
    const response = await fetch(`${API_BASE_URL}/tools/ipc/calculate`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw await parseError(response, 'Error calculando incremento IPC');
    return response.json();
  },

  async downloadMessagePdf(payload: {
    message_id?: string | null;
    question: string;
    answer: string;
    citations: Citation[];
    category?: string | null;
    user_name?: string | null;
    conversation_title?: string | null;
  }): Promise<void> {
    const send = (body: typeof payload) =>
      fetch(`${API_BASE_URL}/tools/reports/pdf`, {
        method: 'POST',
        headers: buildHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });
    // Con message_id el servidor genera una constancia VERIFICADA desde el historial guardado.
    let response = await send(payload);
    if (response.status === 404 && payload.message_id) {
      // Mensaje aún no guardado (p. ej. respuesta interrumpida): constancia marcada como no verificada
      response = await send({ ...payload, message_id: null });
    }
    if (!response.ok) throw await parseError(response, 'Error generando constancia PDF');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `constancia_legalprop_${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async downloadDraftDocument(payload: {
    title: string;
    content: string;
    format: 'docx' | 'pdf' | 'txt';
    user_name?: string | null;
  }): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/tools/drafts/export`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw await parseError(response, `No se pudo generar el archivo .${payload.format}`);
    const blob = await response.blob();
    const disp = response.headers.get('content-disposition') || '';
    const match = disp.match(/filename="?([^"]+)"?/i);
    const filename = match?.[1] || `borrador_legalprop.${payload.format}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};
