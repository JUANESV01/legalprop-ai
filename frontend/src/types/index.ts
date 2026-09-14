export interface Citation {
  source_title: string;
  norma: string;
  articulo?: string;
  fragmento: string;
  similarity_score?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  timestamp: string;
}

export interface ChatQueryRequest {
  query: string;
  category?: 'arriendo' | 'propiedad_horizontal' | null;
  conversation_id?: string;
  temperature?: number;
  use_web_fallback?: boolean;
}

export interface ChatQueryResponse {
  answer: string;
  citations: Citation[];
  conversation_id: string;
  category_detected?: string;
  disclaimer: string;
  metadata?: Record<string, any>;
}

export interface DocumentUploadResponse {
  document_id: string;
  title: string;
  chunks_created: number;
  status: string;
  message: string;
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
