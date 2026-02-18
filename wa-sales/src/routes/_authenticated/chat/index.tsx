import { useCallback, useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useStore } from '@tanstack/react-store'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { ChatList } from '@/components/ChatList'
import { MessageView } from '@/components/MessageView'
import { chatStore } from './-store/chatStore'
import type { Database } from '@/lib/database.types'

type Message = Database['public']['Views']['messages']['Row']

const searchSchema = z.object({
  chatId: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/chat/')({
  validateSearch: searchSchema,

  loader: async ({ location }) => {
    const params = new URLSearchParams(location.search)
    const chatId = params.get('chatId') ?? undefined

    let messages: Message[] = []

    if (chatId) {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('timestamp', { ascending: true })
        .limit(200)

      if (data) {
        messages = data
      }
    }

    return { messages }
  },

  component: MessengerPage,
})

function MessengerPage() {
  const chats = useStore(chatStore, (s) => s.chats)
  const { messages: loaderMessages } = Route.useLoaderData()
  const { chatId } = Route.useSearch()
  const navigate = useNavigate({ from: '/chat' })
  const [realtimeMessages, setRealtimeMessages] = useState<Message[]>([])

  // Reset realtime messages when chatId changes or loader re-runs
  useEffect(() => {
    setRealtimeMessages([])
  }, [chatId, loaderMessages])

  // Subscribe to realtime message broadcasts for the selected chat
  useEffect(() => {
    if (!chatId) return

    const channel = supabase
      .channel(`chat:${chatId}`, { config: { private: true } })
      .on('broadcast', { event: 'INSERT' }, (payload) => {
        const record = payload.payload?.record as Message | undefined
        if (!record) return
        setRealtimeMessages((prev) => [...prev, record])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [chatId])

  // Merge loader + realtime messages, deduplicated by message_id+chat_id
  const messages = useMemo(() => {
    const all = [...loaderMessages, ...realtimeMessages]
    const seen = new Set<string>()
    const deduped: Message[] = []
    for (const msg of all) {
      const key = `${msg.message_id}:${msg.chat_id}`
      if (!seen.has(key)) {
        seen.add(key)
        deduped.push(msg)
      }
    }
    return deduped
  }, [loaderMessages, realtimeMessages])

  const selectedChat = chatId
    ? (chats.find((c) => c.chat_id === chatId) ?? null)
    : null

  const handleSelectChat = useCallback(
    (id: string) => {
      navigate({ search: { chatId: id } })
    },
    [navigate],
  )

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel: Chat list */}
      <div
        className={`flex-shrink-0 border-r border-gray-200 flex flex-col overflow-hidden ${
          chatId ? 'hidden md:flex' : 'flex'
        }`}
        style={{ width: '350px' }}
      >
        <ChatList
          chats={chats}
          selectedChatId={chatId}
          onSelectChat={handleSelectChat}
        />
      </div>

      {/* Right panel: Message view */}
      <div
        className={`flex-1 flex flex-col overflow-hidden ${
          chatId ? 'flex' : 'hidden md:flex'
        }`}
      >
        <MessageView chat={selectedChat} messages={messages} />
      </div>
    </div>
  )
}
