import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'
import type { Session, User } from '@supabase/supabase-js'

export interface RouterContext {
  session: Session | null
  user: User | null
}

export function getRouter() {
  const queryClient = new QueryClient()

  const router = createTanStackRouter({
    routeTree,
    context: {
      session: null,
      user: null,
    } satisfies RouterContext,

    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 30_000,
  })

  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
