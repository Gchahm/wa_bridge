import { createFileRoute, Outlet } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/_authenticated/bookings')({
  loader: async () => {
    const { data, error } = await supabase
      .from('bookings_summary')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching bookings:', error)
    }

    return { bookings: data ?? [] }
  },

  component: BookingsLayout,
})

function BookingsLayout() {
  return <Outlet />
}
