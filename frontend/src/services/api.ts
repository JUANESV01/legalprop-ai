import {
  AuthResponse,
  BackendHealthResponse,
  ChatQueryRequest,
  ChatQueryResponse,
  Citation,
  ConversationDetail,
  ConversationSummary,
  DisambiguationInfo,
  DocumentListResponse,
  DocumentUploadResponse,
  IPCCalcRequest,
  IPCCalcResponse,
  UserProfile,
  UserRole,
} from '../types';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '/api/v1' : 'http://localhost:8000/api/v1');

const TOKEN_KEY = 'legalprop_access_token';
const GUEST_SESSION_KEY = 'legalprop_guest_session_id';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getOrCreateGuestSessionId(): string {
  let id = localStorage.getItem(GUEST_SESSION_KEY);
  if (!id) {
    id = `gs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(GUEST_SESSION_KEY, id);
  }
  return id;
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Guest-Session': getOrCreateGuestSessionId(),
    ...(extra || {}),
  };
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function parseError(response: Response, fallbackMsg: string): Promise<Error> {
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
    disambiguation?: DisambiguationInfo | null;
  }) => void;
  onToken?: (text: string) => void;
  onWebSources?: (citations: Citation[]) => void;
  onDone?: (info: {
    message_id: string;
    conversation_id: string;
    conversation_title: string;
    ttft_ms?: number;
    total_ms?: number;
  }) => void;
  onError?: (detail: string) => void;
}

export const apiService = {
  async checkHealth(): Promise<BackendHealthResponse> {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw await parseError(response, 'Error en health check');
    }
    return response.json();
  },

  // --- AUTENTICACIÓN, REGISTRO, RECUPERACIÓN Y HABEAS DATA ---
  async register(payload: {
    full_name: string;
    email: string;
    password: string;
    role: UserRole;
    security_question: string;
    security_answer: string;
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
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: buildHeaders(),
    });
    if (!response.ok) throw await parseError(response, 'Sesión expirada');
    return response.json();
  },

  async getRecoveryQuestion(email: string): Promise<{ email: string; security_question: string; message: string }> {
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
    security_answer: string;
    new_password: string;
  }): Promise<{ status: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw await parseError(response, 'No se pudo restablecer la contraseña');
    return response.json();
  },

  async changePassword(current_password: string, new_password: string): Promise<{ status: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ current_password, new_password }),
    });
    if (!response.ok) throw await parseError(response, 'Error al cambiar contraseña');
    return response.json();
  },

  async exportMyData(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/export-data`, {
      headers: buildHeaders(),
    });
    if (!response.ok) throw await parseError(response, 'Error al exportar datos');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'legalprop_mis_datos_habeas_data.json';
    a.click();
    URL.revokeObjectURL(url);
  },

  async deleteMyAccount(): Promise<{ status: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    if (!response.ok) throw await parseError(response, 'Error al eliminar la cuenta');
    const data = await response.json();
    setStoredToken(null);
    return data;
  },

  logout(): void {
    setStoredToken(null);
  },

  // --- CHAT & STREAMING SSE (RF04 / HU05) ---
  async queryChat(request: ChatQueryRequest): Promise<ChatQueryResponse> {
    const response = await fetch(`${API_BASE_URL}/chat/query`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(request),
    });
    if (!response.ok) throw await parseError(response, 'Error al procesar consulta');
    return response.json();
  },

  async streamChat(request: ChatQueryRequest, callbacks: StreamChatCallbacks): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json', Accept: 'text/event-stream' }),
      body: JSON.stringify(request),
    });

    if (!response.ok || !response.body) {
      throw await parseError(response, 'Error al conectar el flujo de respuesta en tiempo real');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    const processEventBlock = (block: string) => {
      const lines = block.split('\n');
      let eventName = 'message';
      const dataLines: string[] = [];

      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trim());
        }
      }

      if (dataLines.length === 0) return;
      const dataStr = dataLines.join('\n');
      try {
        const parsed = JSON.parse(dataStr);
        if (eventName === 'metadata') callbacks.onMetadata?.(parsed);
        else if (eventName === 'token') callbacks.onToken?.(parsed.text || '');
        else if (eventName === 'web_sources') callbacks.onWebSources?.(parsed.citations || []);
        else if (eventName === 'done') callbacks.onDone?.(parsed);
        else if (eventName === 'error') callbacks.onError?.(parsed.detail || 'Error de generación');
      } catch (e) {
        console.warn('Error parseando evento SSE:', e);
      }
    };

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

    if (buffer.trim()) {
      processEventBlock(buffer);
    }
  },

  // --- CONVERSACIONES CRUD (HU08 / RF07) ---
  async listConversations(): Promise<ConversationSummary[]> {
    const response = await fetch(`${API_BASE_URL}/conversations`, {
      headers: buildHeaders(),
    });
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

  // --- DOCUMENTOS MULTIFORMATO (HU03 / RF03 / RNF04) ---
  async listDocuments(): Promise<DocumentListResponse> {
    const response = await fetch(`${API_BASE_URL}/documents`, {
      headers: buildHeaders(),
    });
    if (!response.ok) throw await parseError(response, 'Error listando documentos');
    return response.json();
  },

  async uploadDocument(file: File, category: string, title?: string): Promise<DocumentUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    if (title) formData.append('title', title);

    const response = await fetch(`${API_BASE_URL}/documents/upload`, {
      method: 'POST',
      headers: buildHeaders(),
      body: formData,
    });
    if (!response.ok) throw await parseError(response, 'Fallo en la ingesta del archivo');
    return response.json();
  },

  async deleteDocument(docId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/documents/${docId}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    if (!response.ok) throw await parseError(response, 'Error eliminando documento');
  },

  // --- CALCULADORA IPC & REPORTES PDF (HU01 / HU06 / RF01 / RF06) ---
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
    question: string;
    answer: string;
    citations: Citation[];
    category?: string | null;
    user_name?: string | null;
    conversation_title?: string | null;
  }): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/tools/reports/pdf`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw await parseError(response, 'Error generando constancia PDF');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `constancia_legalprop_${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
