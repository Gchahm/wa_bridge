import { useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useStore } from '@tanstack/react-store'
import { z } from 'zod'
import { ChatList } from '@/components/ChatList'
import { MessageView } from '@/components/MessageView'
import { chatStore } from './-store/chatStore'
import { useMessages } from './-hooks/useMessages'

const searchSchema = z.object({
  chatId: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/chat/')({
  validateSearch: searchSchema,
  component: MessengerPage,
})

function MessengerPage() {
  const chats = useStore(chatStore, (s) => s.chats)
  const { chatId } = Route.useSearch()
  const navigate = useNavigate({ from: '/chat' })
  const { messages, ...pagination } = useMessages(chatId)

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
        <MessageView chat={selectedChat} messages={messages} {...pagination} />
      </div>
    </div>
  )
}
