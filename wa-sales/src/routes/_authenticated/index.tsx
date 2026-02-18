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

export const Route = createFileRoute('/_authenticated/')({
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
  const { messages } = Route.useLoaderData()
  const { chatId } = Route.useSearch()
  const navigate = useNavigate({ from: '/' })

  const selectedChat = chatId ? (chats.find((c) => c.chat_id === chatId) ?? null) : null

  function handleSelectChat(id: string) {
    navigate({ search: { chatId: id } })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-200">
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
