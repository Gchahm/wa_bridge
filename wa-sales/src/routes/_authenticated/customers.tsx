import { createFileRoute, Outlet } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/_authenticated/customers')({
  loader: async () => {
    const { data, error } = await supabase
      .from('customers_with_contact')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching customers:', error)
    }

    return { customers: data ?? [] }
  },

  component: CustomersLayout,
})

function CustomersLayout() {
  return <Outlet />
}
