import { ChatQueryRequest, ChatQueryResponse, BackendHealthResponse, DocumentUploadResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const apiService = {
  async checkHealth(): Promise<BackendHealthResponse> {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`Error en health check: ${response.statusText}`);
    }
    return response.json();
  },

  async queryChat(request: ChatQueryRequest): Promise<ChatQueryResponse> {
    const response = await fetch(`${API_BASE_URL}/chat/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Error en la petición' }));
      throw new Error(errorData.detail || `Error al procesar consulta: ${response.statusText}`);
    }

    return response.json();
  },

  async uploadDocument(file: File, category: string, title?: string): Promise<DocumentUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    if (title) formData.append('title', title);

    const response = await fetch(`${API_BASE_URL}/documents/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Error al subir archivo' }));
      throw new Error(err.detail || 'Fallo en la ingesta del archivo');
    }

    return response.json();
  }
};
