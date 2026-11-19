export type UserRole = 'inquilino' | 'propietario' | 'administrador';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  has_security_question: boolean;
  created_at: string;
  documents_count: number;
  conversations_count: number;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

export interface Citation {
  source_title: string;
  norma: string;
  articulo?: string;
  fragmento: string;
  similarity_score?: number;
  source_type?: 'norma' | 'documento_usuario' | 'web';
  url?: string;
  document_id?: string;
}

export interface DisambiguationOption {
  label: string;
  followup_query: string;
}

export interface DisambiguationInfo {
  needed: boolean;
  reason?: string;
  clarifying_questions: string[];
  quick_options: DisambiguationOption[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  disambiguation?: DisambiguationInfo | null;
  timestamp: string;
  isStreaming?: boolean;
  metadata?: Record<string, any>;
}

export interface ChatQueryRequest {
  query: string;
  category?: 'arriendo' | 'propiedad_horizontal' | 'manual_interno' | null;
  conversation_id?: string;
  document_ids?: string[];
  temperature?: number;
  use_web_fallback?: boolean;
}

export interface ChatQueryResponse {
  answer: string;
  citations: Citation[];
  conversation_id: string;
  conversation_title?: string;
  message_id?: string;
  category_detected?: string;
  disambiguation?: DisambiguationInfo | null;
  disclaimer: string;
  metadata?: Record<string, any>;
}

export interface ConversationSummary {
  id: string;
  title: string;
  category?: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  category?: string | null;
  created_at: string;
  updated_at: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    citations: Citation[];
    metadata: Record<string, any>;
    created_at: string;
  }>;
}

export interface DocumentSummary {
  id: string;
  title: string;
  filename: string;
  file_type: string;
  category: string;
  norma_numero?: string;
  chunks_count: number;
  file_size_bytes: number;
  is_public: boolean;
  created_at: string;
  preview?: string;
}

export interface DocumentListResponse {
  total: number;
  total_chunks: number;
  documents: DocumentSummary[];
}

export interface DocumentUploadResponse {
  document_id: string;
  title: string;
  filename?: string;
  file_type?: string;
  category?: string;
  chunks_created: number;
  status: string;
  message: string;
  preview?: string;
}

export interface IPCCalcRequest {
  canon_actual: number;
  anio_reajuste: number;
  ipc_personalizado?: number | null;
  valor_comercial_inmueble?: number | null;
  consultar_web?: boolean;
}

export interface IPCCalcResponse {
  canon_actual: number;
  anio_reajuste: number;
  anio_ipc_base: number;
  ipc_aplicado: number;
  fuente_ipc: string;
  fuente_url?: string | null;
  incremento_maximo: number;
  nuevo_canon_maximo: number;
  cumple_tope_valor_comercial?: boolean | null;
  tope_valor_comercial_1_pct?: number | null;
  fundamento_legal: string;
  requisitos_notificacion: string[];
}

export interface BackendHealthResponse {
  status: string;
  timestamp: string;
  service: string;
  version: string;
  environment: string;
  gemini_api_configured: boolean;
  gemini_model: string;
  vector_store: {
    collection_name: string;
    total_chunks: number;
    status: string;
  };
}
