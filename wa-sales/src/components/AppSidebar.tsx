import { Link, useMatchRoute } from '@tanstack/react-router'
import {
  LayoutDashboard,
  MessageSquare,
  LogOut,
  Plane,
  TicketCheck,
  Users,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const navItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    to: '/' as const,
  },
  {
    title: 'Chat',
    icon: MessageSquare,
    to: '/chat' as const,
  },
  {
    title: 'Customers',
    icon: Users,
    to: '/customers' as const,
  },
  {
    title: 'Requests',
    icon: Plane,
    to: '/requests' as const,
  },
  {
    title: 'Bookings',
    icon: TicketCheck,
    to: '/bookings' as const,
  },
]

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const matchRoute = useMatchRoute()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      !!matchRoute({
                        to: item.to,
                        fuzzy: item.to !== '/',
                      })
                    }
                    tooltip={item.title}
                  >
                    <Link to={item.to}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              onClick={() => supabase.auth.signOut()}
            >
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
