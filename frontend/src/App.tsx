// LegalProp AI — Componente raíz de la Vista (Patrón MVC)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ChatContainer } from './features/chat/ChatContainer';
import { ChatInput } from './features/chat/ChatInput';
import { DocumentUploader } from './features/documents/DocumentUploader';
import { DocumentList } from './features/documents/DocumentList';
import { LegalDisclaimer } from './components/LegalDisclaimer';
import { AboutModal } from './components/AboutModal';
import { AccountProfileModal, AuthTab } from './features/auth/AuthModal';
import { IpcCalculatorModal } from './features/tools/IpcCalculatorModal';
import { MasterPanelModal } from './features/admin/MasterPanelModal';
import { HomePage } from './pages/HomePage';
import { OnboardingPage } from './pages/OnboardingPage';
import { WelcomeOnboardingPage } from './pages/WelcomeOnboardingPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { useAppRoute } from './hooks/useAppRoute';
import {
  AIProvider,
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
  const { route, navigate } = useAppRoute();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<
    'arriendo' | 'propiedad_horizontal' | 'manual_interno' | null
  >(null);
  const [health, setHealth] = useState<BackendHealthResponse | null>(null);

  // Panel lateral desplegable
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  // Modales dentro del chat
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docModalDefaultPublic, setDocModalDefaultPublic] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isIpcModalOpen, setIsIpcModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isMasterPanelOpen, setIsMasterPanelOpen] = useState(false);

  // Estado de cuenta, historial y documentos
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [conversationTitle, setConversationTitle] = useState<string | undefined>(undefined);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isCheckingConversation, setIsCheckingConversation] = useState(false);
  const [aiProvider, setAiProvider] = useState<AIProvider>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('legalprop_ai_provider') : null;
    return saved === 'gemini' || saved === 'grok' || saved === 'auto' ? saved : 'auto';
  });

  const handleChangeAiProvider = (provider: AIProvider) => {
    setAiProvider(provider);
    if (typeof window !== 'undefined') {
      localStorage.setItem('legalprop_ai_provider', provider);
    }
  };

  // Evita recargar la conversación que acabamos de crear por streaming
  const skipNextRouteLoadRef = useRef<string | null>(null);
  const consumedQueryRef = useRef<string | null>(null);
  const sendMessageRef = useRef<(query: string, useWebFallback: boolean) => void>(() => {});

  const fetchHealth = useCallback(async () => {
    try {
      setHealth(await apiService.checkHealth());
    } catch {
      /* backend iniciando */
    }
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      const data = await apiService.listDocuments();
      setDocuments(data.documents || []);
    } catch {
      /* silencioso */
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      setConversations((await apiService.listConversations()) || []);
    } catch {
      /* silencioso */
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!getStoredToken()) {
      setUser(null);
      setAuthReady(true);
      return;
    }
    try {
      setUser(await apiService.getMe());
    } catch {
      apiService.logout();
      setUser(null);
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    refreshProfile();
    fetchDocuments();
    fetchConversations();
    const interval = setInterval(fetchHealth, 25000);
    return () => clearInterval(interval);
  }, [fetchHealth, refreshProfile, fetchDocuments, fetchConversations]);

  // Actualizar título de la pestaña según la ruta y conversación activa
  useEffect(() => {
    if (route.page === 'home') {
      document.title = 'LegalProp AI — Asistente Legal de Propiedad Horizontal, Arriendos y Contratos';
    } else if (route.page === 'login') {
      document.title = 'Iniciar sesión — LegalProp AI';
    } else if (route.page === 'onboarding') {
      document.title = 'Bienvenida — LegalProp AI';
    } else if (route.page === 'privacy') {
      document.title = 'Política de Tratamiento de Datos — LegalProp AI';
    } else if (conversationTitle) {
      document.title = `${conversationTitle} — LegalProp AI`;
    } else {
      document.title = 'Nueva consulta — LegalProp AI';
    }
  }, [route.page, conversationTitle]);

  // Si ya está autenticado y entra a /login, redirigir a /chat/new
  useEffect(() => {
    if (authReady && user && route.page === 'login') {
      navigate('/chat/new', { replace: true });
    }
  }, [authReady, user, route.page, navigate]);

  const loadConversationById = useCallback(
    async (id: string) => {
      setIsCheckingConversation(true);
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
      } catch {
        // Si la conversación no existe, está incompleta o no pertenece a la sesión actual, redirigir a '/'
        setConversationId(undefined);
        setConversationTitle(undefined);
        setMessages([]);
        navigate('/', { replace: true });
      } finally {
        setIsCheckingConversation(false);
      }
    },
    [navigate]
  );

  // Sincronizar URL (/chat/new y /chat/:id) con el estado del chat
  useEffect(() => {
    if (route.page !== 'chat') {
      consumedQueryRef.current = null;
      return;
    }
    if (!authReady) return;

    if (route.openDocs) {
      setDocModalDefaultPublic(false);
      setIsDocModalOpen(true);
      window.history.replaceState(null, '', '/chat/new');
    }

    if (route.openIpc) {
      setIsIpcModalOpen(true);
      window.history.replaceState(null, '', '/chat/new');
    }

    if (route.conversationId === null) {
      if (route.initialQuery && consumedQueryRef.current !== route.initialQuery) {
        const pendingQ = route.initialQuery;
        consumedQueryRef.current = pendingQ;
        setConversationId(undefined);
        setConversationTitle(undefined);
        setMessages([]);
        window.history.replaceState(null, '', '/chat/new');
        sendMessageRef.current(pendingQ, false);
        return;
      }

      if (conversationId !== undefined) {
        setConversationId(undefined);
        setConversationTitle(undefined);
        setMessages([]);
      }
      return;
    }

    if (skipNextRouteLoadRef.current === route.conversationId) {
      skipNextRouteLoadRef.current = null;
      return;
    }

    if (route.conversationId !== conversationId) {
      loadConversationById(route.conversationId);
    }
  }, [authReady, route, conversationId, loadConversationById]);

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
    navigate('/chat/new', { replace: true });
  };

  const handleNewConversation = () => {
    setMessages([]);
    setConversationId(undefined);
    setConversationTitle(undefined);
    navigate('/chat/new');
  };

  const handleSelectConversation = (id: string) => {
    navigate(`/chat/${encodeURIComponent(id)}`);
  };

  const handleOpenAuthRoute = (tab: AuthTab) => {
    const query = tab === 'login' ? '' : `?tab=${tab}`;
    navigate(`/login${query}`);
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

  const handleTogglePublicMaster = async (doc: DocumentSummary) => {
    await apiService.updateDocumentMaster(doc.id, { is_public: !doc.is_public });
    fetchHealth();
    fetchDocuments();
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

  const handleExportDraft = async (
    title: string,
    content: string,
    format: 'docx' | 'pdf' | 'txt'
  ) => {
    await apiService.downloadDraftDocument({
      title,
      content,
      format,
      user_name: user?.full_name || null,
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

    const syncConversationUrl = (newId?: string) => {
      if (!newId) return;
      if (newId !== conversationId) {
        skipNextRouteLoadRef.current = newId;
        setConversationId(newId);
        navigate(`/chat/${encodeURIComponent(newId)}`, { replace: true });
      }
    };

    try {
      await apiService.streamChat(
        {
          query,
          category: selectedCategory,
          conversation_id: conversationId,
          document_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined,
          use_web_fallback: useWebFallback,
          ai_provider: aiProvider,
        },
        {
          onMetadata: (meta) => {
            syncConversationUrl(meta.conversation_id);
            if (meta.conversation_title) setConversationTitle(meta.conversation_title);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantTempId
                  ? {
                      ...m,
                      citations: meta.citations || [],
                      disambiguation: meta.disambiguation || null,
                      metadata: {
                        ...(m.metadata || {}),
                        user_documents_used: meta.user_documents_used,
                        web_fallback_used: meta.web_fallback_used,
                        is_draft_document: meta.is_draft_document,
                      },
                    }
                  : m
              )
            );
          },
          onProvider: (prov) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantTempId
                  ? {
                      ...m,
                      metadata: {
                        ...(m.metadata || {}),
                        provider_used: prov.provider_used,
                        model_used: prov.model_used,
                        fallback_used: prov.fallback_used,
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
            syncConversationUrl(info.conversation_id);
            if (info.conversation_title) setConversationTitle(info.conversation_title);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantTempId
                  ? {
                      ...m,
                      id: info.message_id || m.id,
                      isStreaming: false,
                      metadata: {
                        ...(m.metadata || {}),
                        provider_used: info.provider_used || m.metadata?.provider_used,
                        model_used: info.model_used || m.metadata?.model_used,
                        fallback_used: info.fallback_used ?? m.metadata?.fallback_used,
                        ttft_ms: info.ttft_ms,
                        total_ms: info.total_ms,
                      },
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
                      content: m.content || `No se pudo procesar la consulta: ${detail}`,
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
                content: `No se pudo conectar con el servicio: ${err.message || 'verifica el servidor'}`,
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  sendMessageRef.current = handleSendMessage;

  // --- RUTA 1: / (Landing page principal) ---
  if (route.page === 'home') {
    return <HomePage user={user} onNavigate={(path) => navigate(path)} />;
  }

  // --- RUTA 2: /login (Inicio de sesión, Registro y Recuperación) ---
  if (route.page === 'login') {
    return (
      <OnboardingPage
        initialTab={route.tab}
        onAuthSuccess={handleAuthSuccess}
        onNavigate={(path) => navigate(path)}
      />
    );
  }

  // --- RUTA 3: /onboarding (Pasos rápidos de bienvenida para usuarios nuevos) ---
  if (route.page === 'onboarding') {
    return (
      <WelcomeOnboardingPage
        user={user}
        onSelectCategory={setSelectedCategory}
        onUploadSuccess={handleUploadSuccess}
        onNavigate={(path) => navigate(path)}
      />
    );
  }

  // --- RUTA 4: /privacidad (Política de Tratamiento de Datos Personales — Ley 1581 de 2012) ---
  if (route.page === 'privacy') {
    return <PrivacyPolicyPage onNavigate={(path) => navigate(path)} />;
  }

  // Mientras valida un ID directo de conversación en URL, evitar parpadeo antes de redirigir a '/' si no existe
  if (route.conversationId && (!authReady || isCheckingConversation) && conversationId !== route.conversationId) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center text-slate-600 text-xs font-medium">
        Cargando conversación...
      </div>
    );
  }

  // --- RUTA 3 & 4: /chat/new y /chat/:conversationId ---
  const userDocuments = documents.filter((d) => !d.is_public);

  return (
    <div className="flex flex-col h-screen bg-cream-100 text-slate-800 font-sans selection:bg-teal-100 selection:text-teal-900 overflow-hidden">
      <a
        href="#main-chat"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:bg-teal-800 focus:text-white focus:rounded-lg focus:text-xs focus:font-semibold"
      >
        Saltar al contenido principal
      </a>
      <Header
        health={health}
        sidebarOpen={sidebarOpen}
        userDocsCount={userDocuments.length}
        conversationTitle={conversationTitle}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onGoHome={() => navigate('/')}
        onOpenDocuments={() => {
          setDocModalDefaultPublic(false);
          setIsDocModalOpen(true);
        }}
        onOpenIpc={() => setIsIpcModalOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar
          isOpen={sidebarOpen}
          onCloseMobile={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
              setSidebarOpen(false);
            }
          }}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          conversations={conversations}
          activeConversationId={conversationId}
          onNewConversation={handleNewConversation}
          onSelectConversation={handleSelectConversation}
          onRenameConversation={handleRenameConversation}
          onDeleteConversation={handleDeleteConversation}
          onExportConversationPdf={(id) => apiService.downloadConversationPdf(id)}
          user={user}
          onOpenAuth={handleOpenAuthRoute}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onOpenAbout={() => setIsAboutModalOpen(true)}
          onOpenDocuments={() => {
            setDocModalDefaultPublic(false);
            setIsDocModalOpen(true);
          }}
          onOpenIpc={() => setIsIpcModalOpen(true)}
          onOpenMasterPanel={() => setIsMasterPanelOpen(true)}
        />

        <main id="main-chat" className="flex-1 flex flex-col min-w-0 bg-cream-100 relative">
          <ChatContainer
            messages={messages}
            userName={user?.full_name}
            onSelectPrompt={(p) => handleSendMessage(p, false)}
            onExportPdf={handleExportMessagePdf}
            onExportDraft={handleExportDraft}
          />

          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            onOpenUpload={() => {
              setDocModalDefaultPublic(false);
              setIsDocModalOpen(true);
            }}
            userDocuments={userDocuments}
            selectedDocIds={selectedDocIds}
            onToggleDocId={handleToggleDocId}
            aiProvider={aiProvider}
            onChangeAiProvider={handleChangeAiProvider}
          />
        </main>
      </div>

      <LegalDisclaimer />

      {/* Panel lateral de Documentos */}
      {isDocModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl bg-cream-50 border-l border-cream-200 h-full p-5 sm:p-6 overflow-y-auto space-y-5 flex flex-col justify-between shadow-2xl">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-cream-200">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Documentos y Reglamentos</h2>
                    <p className="text-xs text-slate-500">PDF, Word, TXT, Excel, ODT o imágenes</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDocModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-cream-100"
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <DocumentUploader
                onUploadSuccess={handleUploadSuccess}
                isMaster={user?.role === 'master'}
                defaultPublic={docModalDefaultPublic}
              />

              <DocumentList
                health={health}
                documents={documents}
                selectedDocIds={selectedDocIds}
                onToggleSelectDoc={handleToggleDocId}
                onDeleteDoc={handleDeleteDocument}
                onTogglePublicMaster={user?.role === 'master' ? handleTogglePublicMaster : undefined}
                isAuthenticated={Boolean(user)}
                isMaster={user?.role === 'master'}
              />
            </div>
          </div>
        </div>
      )}

      <MasterPanelModal
        isOpen={isMasterPanelOpen}
        onClose={() => setIsMasterPanelOpen(false)}
        onOpenGlobalUploader={() => {
          setDocModalDefaultPublic(true);
          setIsDocModalOpen(true);
        }}
        onRefreshDocuments={() => {
          fetchHealth();
          fetchDocuments();
        }}
      />

      <AccountProfileModal
        isOpen={isProfileModalOpen}
        user={user}
        onClose={() => setIsProfileModalOpen(false)}
        onLogout={handleLogout}
        onAccountDeleted={handleLogout}
      />

      <IpcCalculatorModal
        isOpen={isIpcModalOpen}
        onClose={() => setIsIpcModalOpen(false)}
        onAskInChat={(prompt) => handleSendMessage(prompt, true)}
      />

      <AboutModal isOpen={isAboutModalOpen} onClose={() => setIsAboutModalOpen(false)} />
    </div>
  );
};

export default App;
