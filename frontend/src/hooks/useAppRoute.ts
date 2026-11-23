import { useState, useEffect, useCallback } from 'react';

export type AppRoute =
  | { page: 'home' }
  | { page: 'login'; tab: 'login' | 'register' | 'recovery' }
  | { page: 'onboarding' }
  | { page: 'privacy' }
  | {
      page: 'chat';
      conversationId: string | null;
      openDocs: boolean;
      openIpc: boolean;
      initialQuery: string | null;
    };

function parseLocation(): { route: AppRoute; canonicalPath: string | null } {
  const rawPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const search = window.location.search;
  const params = new URLSearchParams(search);

  // Landing principal en '/' (y compatibilidad '/home' -> '/')
  if (rawPath === '/') {
    return { route: { page: 'home' }, canonicalPath: null };
  }

  if (rawPath === '/home') {
    return { route: { page: 'home' }, canonicalPath: '/' };
  }

  // Pantalla de inicio de sesión y registro en '/login'
  if (
    rawPath === '/login' ||
    rawPath === '/register' ||
    rawPath === '/chat/onboarding' ||
    rawPath === '/chat/omboarding'
  ) {
    const rawTab = rawPath === '/register' ? 'register' : params.get('tab');
    const tab =
      rawTab === 'register' || rawTab === 'recovery' ? rawTab : 'login';
    const canonical =
      rawPath === '/login'
        ? null
        : tab === 'login'
        ? '/login'
        : `/login?tab=${tab}`;
    return {
      route: { page: 'login', tab },
      canonicalPath: canonical,
    };
  }

  // Pasos rápidos de bienvenida/configuración inicial para usuarios nuevos en '/onboarding'
  if (rawPath === '/onboarding' || rawPath === '/omboarding') {
    return {
      route: { page: 'onboarding' },
      canonicalPath: rawPath === '/omboarding' ? '/onboarding' : null,
    };
  }

  // Política de Tratamiento de Datos y Términos de Uso (RTK Solutions / Ley 1581) en '/privacidad'
  if (
    rawPath === '/privacidad' ||
    rawPath === '/privacy' ||
    rawPath === '/politica-de-datos' ||
    rawPath === '/terminos' ||
    rawPath === '/tyc'
  ) {
    return {
      route: { page: 'privacy' },
      canonicalPath: rawPath === '/privacidad' ? null : '/privacidad',
    };
  }

  // Chat nuevo en '/chat/new' (y '/chat' -> '/chat/new')
  if (rawPath === '/chat' || rawPath === '/chat/new') {
    const q = params.get('q')?.trim() || null;
    return {
      route: {
        page: 'chat',
        conversationId: null,
        openDocs: params.get('docs') === '1',
        openIpc: params.get('ipc') === '1',
        initialQuery: q,
      },
      canonicalPath: rawPath === '/chat' ? `/chat/new${search}` : null,
    };
  }

  // Conversación guardada con su ID único en '/chat/:id'
  if (rawPath.startsWith('/chat/')) {
    const rest = rawPath.slice('/chat/'.length);
    if (rest && !rest.includes('/')) {
      const id = decodeURIComponent(rest).trim();
      if (id && id !== 'new') {
        return {
          route: {
            page: 'chat',
            conversationId: id,
            openDocs: false,
            openIpc: false,
            initialQuery: null,
          },
          canonicalPath: null,
        };
      }
    }
  }

  // Cualquier URL no reconocida redirige limpiamente a '/'
  return { route: { page: 'home' }, canonicalPath: '/' };
}

export function useAppRoute() {
  const [route, setRoute] = useState<AppRoute>(() => parseLocation().route);

  useEffect(() => {
    const syncFromWindow = () => {
      const parsed = parseLocation();
      if (parsed.canonicalPath) {
        window.history.replaceState(null, '', parsed.canonicalPath);
      }
      setRoute(parsed.route);
    };

    syncFromWindow();
    window.addEventListener('popstate', syncFromWindow);
    return () => window.removeEventListener('popstate', syncFromWindow);
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    const current = window.location.pathname + window.location.search;
    if (current !== to) {
      if (options?.replace) {
        window.history.replaceState(null, '', to);
      } else {
        window.history.pushState(null, '', to);
      }
    }
    const parsed = parseLocation();
    if (parsed.canonicalPath) {
      window.history.replaceState(null, '', parsed.canonicalPath);
    }
    setRoute(parsed.route);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  return { route, navigate };
}
