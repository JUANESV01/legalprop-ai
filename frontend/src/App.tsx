import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ChatContainer } from './features/chat/ChatContainer';
import { ChatInput } from './features/chat/ChatInput';
import { DocumentUploader } from './features/documents/DocumentUploader';
import { DocumentList } from './features/documents/DocumentList';
import { ChatMessage, BackendHealthResponse } from './types';
import { apiService } from './services/api';
import { X } from 'lucide-react';

export const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'arriendo' | 'propiedad_horizontal' | null>(null);
  const [health, setHealth] = useState<BackendHealthResponse | null>(null);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
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
        content: `Error al procesar la consulta: ${err.message || 'Verifica la conexión con el backend en localhost:8000'}`,
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
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans">
      <Header health={health} onOpenDocuments={() => setIsDocModalOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onSelectPrompt={handleSelectPrompt}
        />

        <main className="flex-1 flex flex-col min-w-0 bg-slate-950">
          <ChatContainer
            messages={messages}
            isLoading={isLoading}
            onSelectPrompt={(p) => handleSendMessage(p, false)}
          />

          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            selectedCategory={selectedCategory}
          />
        </main>
      </div>

      {/* Modal / Drawer de Normativas */}
      {isDocModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <h2 className="text-lg font-bold text-slate-100">Gestión de Corpus Normativo</h2>
                <button
                  onClick={() => setIsDocModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <DocumentList health={health} />
              <DocumentUploader onUploadSuccess={fetchHealth} />
            </div>

            <div className="pt-4 border-t border-slate-800 text-xs text-slate-500 text-center">
              LegalProp AI • Motor RAG con ChromaDB y Google Gemini API
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
