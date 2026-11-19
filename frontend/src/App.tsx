import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ChatContainer } from './features/chat/ChatContainer';
import { ChatInput } from './features/chat/ChatInput';
import { DocumentUploader } from './features/documents/DocumentUploader';
import { DocumentList } from './features/documents/DocumentList';
import { LegalDisclaimer } from './components/LegalDisclaimer';
import { AboutModal } from './components/AboutModal';
import { AuthModal, AccountProfileModal, AuthTab } from './features/auth/AuthModal';
import { IpcCalculatorModal } from './features/tools/IpcCalculatorModal';
import {
  ChatMessage,
  BackendHealthResponse,
  UserProfile,
  ConversationSummary,
  DocumentSummary,
  DocumentUploadResponse,
} from './types';
import { apiService, getStoredToken } from './services/api';
import { X, Layers } from 'lucide-react';

export const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<
    'arriendo' | 'propiedad_horizontal' | 'manual_interno' | null
  >(null);
  const [health, setHealth] = useState<BackendHealthResponse | null>(null);

  // Modals & UI drawers
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isIpcModalOpen, setIsIpcModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<AuthTab>('login');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auth, History & Documents state
  const [user, setUser] = useState<UserProfile | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [conversationTitle, setConversationTitle] = useState<string | undefined>(undefined);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await apiService.checkHealth();
      setHealth(data);
    } catch (err) {
      console.warn('Backend no accesible aún:', err);
    }
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      const data = await apiService.listDocuments();
      setDocuments(data.documents || []);
    } catch (err) {
      console.warn('No se pudieron listar documentos:', err);
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const list = await apiService.listConversations();
      setConversations(list || []);
    } catch (err) {
      console.warn('No se pudo cargar historial:', err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!getStoredToken()) {
      setUser(null);
      return;
    }
    try {
      const me = await apiService.getMe();
      setUser(me);
    } catch {
      apiService.logout();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    refreshProfile();
    fetchDocuments();
    fetchConversations();
    const interval = setInterval(fetchHealth, 20000);
    return () => clearInterval(interval);
  }, [fetchHealth, refreshProfile, fetchDocuments, fetchConversations]);

  const handleAuthSuccess = (loggedUser: UserProfile) => {
    setUser(loggedUser);
    setMessages([]);
    setConversationId(undefined);
    setConversationTitle(undefined);
    setSelectedDocIds([]);
    fetchDocuments();
    fetchConversations();
  };

  const handleLogout = () => {
    apiService.logout();
    setUser(null);
    setMessages([]);
    setConversationId(undefined);
    setConversationTitle(undefined);
    setSelectedDocIds([]);
    fetchDocuments();
    fetchConversations();
  };

  const handleNewConversation = () => {
    setMessages([]);
    setConversationId(undefined);
    setConversationTitle(undefined);
  };

  const handleSelectConversation = async (id: string) => {
    try {
      const detail = await apiService.getConversation(id);
      setConversationId(detail.id);
      setConversationTitle(detail.title);
      setMessages(
        detail.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          citations: m.citations,
          disambiguation: m.metadata?.disambiguation || null,
          metadata: m.metadata,
          timestamp: new Date(m.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        }))
      );
    } catch (err) {
      console.error('Error abriendo conversación:', err);
    }
  };

  const handleRenameConversation = async (id: string, title: string) => {
    await apiService.renameConversation(id, title);
    if (id === conversationId) setConversationTitle(title);
    fetchConversations();
  };

  const handleDeleteConversation = async (id: string) => {
    await apiService.deleteConversation(id);
    if (id === conversationId) handleNewConversation();
    fetchConversations();
    refreshProfile();
  };

  const handleToggleDocId = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleUploadSuccess = (uploaded?: DocumentUploadResponse) => {
    fetchHealth();
    fetchDocuments();
    refreshProfile();
    if (uploaded?.document_id) {
      setSelectedDocIds((prev) =>
        prev.includes(uploaded.document_id) ? prev : [...prev, uploaded.document_id]
      );
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    await apiService.deleteDocument(docId);
    setSelectedDocIds((prev) => prev.filter((id) => id !== docId));
    fetchHealth();
    fetchDocuments();
    refreshProfile();
  };

  const handleExportMessagePdf = async (question: string, message: ChatMessage) => {
    await apiService.downloadMessagePdf({
      question,
      answer: message.content,
      citations: message.citations || [],
      category: selectedCategory || 'General',
      user_name: user?.full_name || null,
      conversation_title: conversationTitle || null,
    });
  };

  const handleSendMessage = async (query: string, useWebFallback: boolean) => {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: nowTime,
    };

    const assistantTempId = `a_${Date.now() + 1}`;
    const placeholderAssistant: ChatMessage = {
      id: assistantTempId,
      role: 'assistant',
      content: '',
      citations: [],
      timestamp: nowTime,
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, placeholderAssistant]);
    setIsLoading(true);

    try {
      await apiService.streamChat(
        {
          query,
          category: selectedCategory,
          conversation_id: conversationId,
          document_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined,
          use_web_fallback: useWebFallback,
        },
        {
          onMetadata: (meta) => {
            if (meta.conversation_id) setConversationId(meta.conversation_id);
            if (meta.conversation_title) setConversationTitle(meta.conversation_title);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantTempId
                  ? {
                      ...m,
                      citations: meta.citations || [],
                      disambiguation: meta.disambiguation || null,
                      metadata: {
                        user_documents_used: meta.user_documents_used,
                        web_fallback_used: meta.web_fallback_used,
                      },
                    }
                  : m
              )
            );
          },
          onToken: (text) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantTempId ? { ...m, content: m.content + text } : m
              )
            );
          },
          onWebSources: (updatedCitations) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantTempId
                  ? {
                      ...m,
                      citations: updatedCitations,
                      metadata: { ...(m.metadata || {}), web_fallback_used: true },
                    }
                  : m
              )
            );
          },
          onDone: (info) => {
            if (info.conversation_id) setConversationId(info.conversation_id);
            if (info.conversation_title) setConversationTitle(info.conversation_title);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantTempId
                  ? {
                      ...m,
                      id: info.message_id || m.id,
                      isStreaming: false,
                    }
                  : m
              )
            );
          },
          onError: (detail) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantTempId
                  ? {
                      ...m,
                      content: m.content || `Error al procesar la consulta: ${detail}`,
                      isStreaming: false,
                    }
                  : m
              )
            );
          },
        }
      );
      fetchConversations();
      refreshProfile();
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantTempId
            ? {
                ...m,
                content: `Error al procesar la consulta: ${
                  err.message || 'Verifica que el servidor backend esté activo en localhost:8000'
                }`,
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPrompt = (prompt: string, category?: 'arriendo' | 'propiedad_horizontal') => {
    if (category) setSelectedCategory(category);
    handleSendMessage(prompt, true);
  };

  const userDocuments = documents.filter((d) => !d.is_public);

  return (
    <div className="flex flex-col h-screen bg-cream-100 text-slate-800 font-sans selection:bg-teal-100 selection:text-teal-900 overflow-hidden">
      {/* Encabezado Principal con Logo, IPC, Documentos y Login/Registro/Perfil */}
      <Header
        health={health}
        user={user}
        userDocsCount={userDocuments.length}
        onOpenDocuments={() => setIsDocModalOpen(true)}
        onOpenAbout={() => setIsAboutModalOpen(true)}
        onOpenIpc={() => setIsIpcModalOpen(true)}
        onOpenAuth={(tab) => {
          setAuthModalTab(tab);
          setIsAuthModalOpen(true);
        }}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onToggleMobileMenu={() => setMobileMenuOpen((v) => !v)}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Barra Lateral con Historial CRUD, Filtros, IPC y Sugerencias */}
        <Sidebar
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onSelectPrompt={handleSelectPrompt}
          onOpenAbout={() => setIsAboutModalOpen(true)}
          onOpenIpc={() => setIsIpcModalOpen(true)}
          conversations={conversations}
          activeConversationId={conversationId}
          onNewConversation={handleNewConversation}
          onSelectConversation={handleSelectConversation}
          onRenameConversation={handleRenameConversation}
          onDeleteConversation={handleDeleteConversation}
          onExportConversationPdf={(id) => apiService.downloadConversationPdf(id)}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Área Central de Conversación */}
        <main className="flex-1 flex flex-col min-w-0 bg-cream-100 relative">
          <ChatContainer
            messages={messages}
            isLoading={isLoading}
            onSelectPrompt={(p) => handleSendMessage(p, true)}
            onOpenIpcCalculator={() => setIsIpcModalOpen(true)}
            onOpenDocuments={() => setIsDocModalOpen(true)}
            onExportPdf={handleExportMessagePdf}
          />

          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            selectedCategory={selectedCategory}
            onOpenUpload={() => setIsDocModalOpen(true)}
            userDocuments={userDocuments}
            selectedDocIds={selectedDocIds}
            onToggleDocId={handleToggleDocId}
          />
        </main>
      </div>

      {/* Franja de Advertencia y Alcance Legal */}
      <LegalDisclaimer />

      {/* Panel Lateral de Gestión de Documentos */}
      {isDocModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl bg-cream-50 border-l border-cream-200 h-full p-5 sm:p-6 overflow-y-auto space-y-5 flex flex-col justify-between shadow-2xl text-slate-800">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-cream-200">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Documentos y Reglamentos</h2>
                    <p className="text-xs text-slate-500">
                      Sube archivos PDF, DOCX, TXT o Excel para que LegalProp responda con base en ellos
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDocModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-cream-100 transition-colors"
                  title="Cerrar panel"
                  aria-label="Cerrar panel de documentos"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Subida Multi-formato */}
              <DocumentUploader onUploadSuccess={handleUploadSuccess} />

              {/* Lista de Documentos Propios + Leyes Base */}
              <DocumentList
                health={health}
                documents={documents}
                selectedDocIds={selectedDocIds}
                onToggleSelectDoc={handleToggleDocId}
                onDeleteDoc={handleDeleteDocument}
                isAuthenticated={Boolean(user)}
              />
            </div>

            <div className="pt-4 border-t border-cream-200 text-xs text-slate-500 text-center font-mono">
              LegalProp AI • Aislamiento privado por cuenta (RNF04) • Ley 820 & Ley 675
            </div>
          </div>
        </div>
      )}

      {/* Modal de Login / Registro / Recuperación de Contraseña */}
      <AuthModal
        isOpen={isAuthModalOpen}
        initialTab={authModalTab}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Modal de Perfil y Privacidad (Habeas Data) */}
      <AccountProfileModal
        isOpen={isProfileModalOpen}
        user={user}
        onClose={() => setIsProfileModalOpen(false)}
        onLogout={handleLogout}
        onAccountDeleted={handleLogout}
      />

      {/* Modal Calculadora Legal de IPC */}
      <IpcCalculatorModal
        isOpen={isIpcModalOpen}
        onClose={() => setIsIpcModalOpen(false)}
        onAskInChat={(prompt) => handleSendMessage(prompt, true)}
      />

      {/* Modal Acerca del Proyecto */}
      <AboutModal isOpen={isAboutModalOpen} onClose={() => setIsAboutModalOpen(false)} />
    </div>
  );
};

export default App;
