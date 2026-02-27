import { createFileRoute, Outlet } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/_authenticated/requests')({
  loader: async () => {
    const { data, error } = await supabase
      .from('flight_requests_summary')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching flight requests:', error)
    }

    return { requests: data ?? [] }
  },

  component: RequestsLayout,
})

function RequestsLayout() {
  return <Outlet />
}
