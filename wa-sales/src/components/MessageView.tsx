import { useEffect, useRef } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { MessageBubble, getMessageDateKey } from './MessageBubble'
import type { Database } from '@/lib/database.types'

type Chat = Database['public']['Views']['chats']['Row']
type Message = Database['public']['Views']['messages']['Row']

type MessageViewProps = {
  chat: Chat | null
  messages: Message[]
}

export function MessageView({ chat, messages }: MessageViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!chat) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center"
        style={{ backgroundColor: '#efeae2' }}
      >
        <div className="flex flex-col items-center gap-4 text-center px-8">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#d1fae5' }}
          >
            <MessageSquare className="w-10 h-10" style={{ color: '#00a884' }} />
          </div>
          <div>
            <h2 className="text-2xl font-light text-gray-700 mb-2">WA Sales</h2>
            <p className="text-gray-500 text-sm max-w-sm leading-relaxed">
              Select a chat to view messages
            </p>
          </div>
        </div>
      </div>
    )
  }

  const displayName = chat.name || chat.chat_id || ''

  // Track date separators
  const seenDates = new Set<string>()

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Chat header */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0 shadow-sm"
        style={{ backgroundColor: '#f0f2f5' }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
          style={{ backgroundColor: '#00a884' }}
        >
          {displayName.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 text-sm truncate">{displayName}</h2>
          <p className="text-xs text-gray-500">
            {chat.is_group ? 'Group chat' : 'Private chat'}
          </p>
        </div>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ backgroundColor: '#efeae2' }}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-500 bg-white px-4 py-2 rounded-full shadow-sm">
              No messages in this chat
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              const timestamp = message.timestamp
              let showDateSeparator = false

              if (timestamp) {
                const dateKey = getMessageDateKey(timestamp)
                if (!seenDates.has(dateKey)) {
                  seenDates.add(dateKey)
                  showDateSeparator = true
                }
              }

              return (
                <MessageBubble
                  key={`${message.message_id}-${message.chat_id}`}
                  message={message}
                  isGroup={chat.is_group ?? false}
                  showDateSeparator={showDateSeparator}
                />
              )
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Disabled message input */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ backgroundColor: '#f0f2f5' }}
      >
        <div className="flex-1 bg-white rounded-full px-4 py-2.5 flex items-center">
          <span className="text-sm text-gray-400 select-none">
            Message sending is not available yet
          </span>
        </div>
        <button
          type="button"
          disabled
          className="w-10 h-10 rounded-full flex items-center justify-center text-white cursor-not-allowed opacity-50 flex-shrink-0"
          style={{ backgroundColor: '#00a884' }}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
