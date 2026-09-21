import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ChatContainer } from './features/chat/ChatContainer';
import { ChatInput } from './features/chat/ChatInput';
import { DocumentUploader } from './features/documents/DocumentUploader';
import { DocumentList } from './features/documents/DocumentList';
import { LegalDisclaimer } from './components/LegalDisclaimer';
import { AboutModal } from './components/AboutModal';
import { ChatMessage, BackendHealthResponse } from './types';
import { apiService } from './services/api';
import { X, Layers } from 'lucide-react';

export const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'arriendo' | 'propiedad_horizontal' | null>(null);
  const [health, setHealth] = useState<BackendHealthResponse | null>(null);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);

  const fetchHealth = async () => {
    try {
      const data = await apiService.checkHealth();
      setHealth(data);
    } catch (err) {
      console.warn('Backend no accesible aún:', err);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = async (query: string, useWebFallback: boolean) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await apiService.queryChat({
        query,
        category: selectedCategory,
        conversation_id: conversationId,
        use_web_fallback: useWebFallback,
      });

      if (res.conversation_id) {
        setConversationId(res.conversation_id);
      }

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.answer,
        citations: res.citations,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error al procesar la consulta: ${err.message || 'Verifica la conexión con el servidor en localhost:8000'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPrompt = (prompt: string, category?: 'arriendo' | 'propiedad_horizontal') => {
    if (category) setSelectedCategory(category);
    handleSendMessage(prompt, false);
  };

  return (
    <div className="flex flex-col h-screen bg-cream-100 text-slate-800 font-sans selection:bg-teal-100 selection:text-teal-900 overflow-hidden">
      {/* Encabezado Principal con Logo LegalProp-AI y Botón Acerca De */}
      <Header
        health={health}
        onOpenDocuments={() => setIsDocModalOpen(true)}
        onOpenAbout={() => setIsAboutModalOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Barra Lateral de Categorías y Sugerencias */}
        <Sidebar
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onSelectPrompt={handleSelectPrompt}
          onOpenAbout={() => setIsAboutModalOpen(true)}
        />

        {/* Área Central de Conversación */}
        <main className="flex-1 flex flex-col min-w-0 bg-cream-100 relative">
          <ChatContainer
            messages={messages}
            isLoading={isLoading}
            onSelectPrompt={(p) => handleSendMessage(p, false)}
          />

          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            selectedCategory={selectedCategory}
            onOpenUpload={() => setIsDocModalOpen(true)}
          />
        </main>
      </div>

      {/* Franja de Advertencia y Alcance Legal */}
      <LegalDisclaimer />

      {/* Modal / Panel Lateral de Gestión de Documentos */}
      {isDocModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end animate-fadeIn">
          <div className="w-full max-w-xl bg-cream-50 border-l border-cream-200 h-full p-6 overflow-y-auto space-y-6 flex flex-col justify-between shadow-2xl text-slate-800">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-cream-200">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Documentos y Reglamentos</h2>
                    <p className="text-xs text-slate-500">Incorpora reglamentos internos o contratos para consultas</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDocModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-cream-100 transition-colors"
                  title="Cerrar panel"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Lista de Normas Base */}
              <DocumentList health={health} />

              {/* Subida Multi-formato (PDF, DOCX, XLSX, ODT, TXT, Imágenes) */}
              <DocumentUploader onUploadSuccess={fetchHealth} />
            </div>

            <div className="pt-4 border-t border-cream-200 text-xs text-slate-500 text-center font-mono">
              LegalProp • Régimen de Arrendamiento y Propiedad Horizontal en Colombia
            </div>
          </div>
        </div>
      )}

      {/* Modal Acerca del Proyecto */}
      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
      />
    </div>
  );
};

export default App;
