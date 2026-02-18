import { useEffect } from 'react'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import {
  handleChatDelete,
  handleChatInsert,
  handleChatUpdate,
  initChatStore,
} from './chat/-store/chatStore'

export const Route = createFileRoute('/_authenticated/chat')({
  staleTime: Infinity,

  loader: async () => {
    const { data, error } = await supabase
      .from('chats_with_preview')
      .select('*')
      .order('last_message_timestamp', {
        ascending: false,
        nullsFirst: false,
      })

    if (error) {
      console.error('Error fetching chats:', error)
    }

    return { chats: data ?? [] }
  },

  component: ChatLayout,
})

function ChatLayout() {
  const { chats } = Route.useLoaderData()

  useEffect(() => {
    initChatStore(chats)
  }, [chats])

  useEffect(() => {
    const channel = supabase
      .channel('chats', { config: { private: true } })
      .on('broadcast', { event: 'INSERT' }, (payload) =>
        handleChatInsert(payload.payload),
      )
      .on('broadcast', { event: 'UPDATE' }, (payload) =>
        handleChatUpdate(payload.payload),
      )
      .on('broadcast', { event: 'DELETE' }, (payload) =>
        handleChatDelete(payload.payload),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return <Outlet />
}
