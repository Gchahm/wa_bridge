import { Search } from 'lucide-react'
import { ChatItem } from './ChatItem'
import type { ChatWithPreview } from './ChatItem'

type ChatListProps = {
  chats: ChatWithPreview[]
  selectedChatId: string | undefined
  onSelectChat: (chatId: string) => void
}

export function ChatList({ chats, selectedChatId, onSelectChat }: ChatListProps) {
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#ffffff' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ backgroundColor: '#f0f2f5' }}
      >
        <h1 className="text-xl font-semibold text-gray-800">Chats</h1>
      </div>

      {/* Search box */}
      <div className="px-3 py-2 flex-shrink-0" style={{ backgroundColor: '#f0f2f5' }}>
        <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search or start new chat"
            className="flex-1 text-sm text-gray-700 placeholder-gray-400 outline-none bg-transparent"
            readOnly
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400">
            No chats found
          </div>
        ) : (
          chats.map((chat) => (
            <ChatItem
              key={chat.chat_id}
              chat={chat}
              isActive={chat.chat_id === selectedChatId}
              onClick={() => chat.chat_id && onSelectChat(chat.chat_id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
