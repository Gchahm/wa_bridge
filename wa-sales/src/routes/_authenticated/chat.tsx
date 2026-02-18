import { useEffect } from 'react'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import type { ChatWithPreview } from '@/components/ChatItem'
import {
  initChatStore,
  handleChatInsert,
  handleChatUpdate,
  handleChatDelete,
} from './chat/-store/chatStore'

export const Route = createFileRoute('/_authenticated/chat')({
  staleTime: Infinity,

  loader: async () => {
    const { data: chats, error: chatsError } = await supabase
      .from('chats')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (chatsError) {
      console.error('Error fetching chats:', chatsError)
    }

    const chatList = chats ?? []

    const chatIds = chatList.map((c) => c.chat_id).filter(Boolean) as string[]

    let lastMessages: Record<string, { content: string | null; timestamp: string | null }> = {}

    if (chatIds.length > 0) {
      const { data: previewMessages } = await supabase
        .from('messages')
        .select('chat_id, content, timestamp, message_type, media_type')
        .in('chat_id', chatIds)
        .order('timestamp', { ascending: false })
        .limit(chatIds.length * 3)

      if (previewMessages) {
        for (const msg of previewMessages) {
          const cid = msg.chat_id
          if (cid && !lastMessages[cid]) {
            const content =
              msg.content ||
              (msg.message_type !== 'text' && msg.message_type !== 'chat'
                ? `[${msg.media_type || msg.message_type}]`
                : null)
            lastMessages[cid] = {
              content,
              timestamp: msg.timestamp,
            }
          }
        }
      }
    }

    const chatsWithPreview: ChatWithPreview[] = chatList.map((chat) => ({
      ...chat,
      lastMessage: (chat.chat_id && lastMessages[chat.chat_id]?.content) ?? null,
      lastMessageAt:
        (chat.chat_id && lastMessages[chat.chat_id]?.timestamp) ?? chat.last_message_at,
    }))

    return { chats: chatsWithPreview }
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
      .on('broadcast', { event: 'INSERT' }, (payload) => handleChatInsert(payload.payload))
      .on('broadcast', { event: 'UPDATE' }, (payload) => handleChatUpdate(payload.payload))
      .on('broadcast', { event: 'DELETE' }, (payload) => handleChatDelete(payload.payload))
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return <Outlet />
}
