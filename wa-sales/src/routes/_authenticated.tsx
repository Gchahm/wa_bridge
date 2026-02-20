import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/AppSidebar'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context }) => {
    // Only redirect on the client — the server has no localStorage
    // so the session is always null during SSR
    if (typeof window !== 'undefined' && !context.session) {
      throw redirect({ to: '/login' })
    }
  },

  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return (
    <SidebarProvider defaultOpen={false} className="!min-h-0 h-svh">
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
