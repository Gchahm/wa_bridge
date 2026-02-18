import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, MessageSquare, Send } from 'lucide-react'
import { MessageBubble, getMessageDateKey } from './MessageBubble'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Chat = Database['public']['Views']['chats']['Row']
type Message = Database['public']['Views']['messages']['Row']

type MessageViewProps = {
  chat: Chat | null
  messages: Message[]
  fetchNextPage: () => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
}

export function MessageView({
  chat,
  messages,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
}: MessageViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  const loadingOlderRef = useRef(false)
  const savedScrollRef = useRef<{ height: number; top: number } | null>(null)

  // Reset scroll anchor when chat changes
  const prevChatId = useRef(chat?.chat_id)
  useEffect(() => {
    if (chat?.chat_id !== prevChatId.current) {
      prevChatId.current = chat?.chat_id
      isNearBottomRef.current = true
      loadingOlderRef.current = false
      savedScrollRef.current = null
    }
  }, [chat?.chat_id])

  // After render: restore scroll position or scroll to bottom
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || messages.length === 0) return

    if (loadingOlderRef.current && savedScrollRef.current) {
      const { height, top } = savedScrollRef.current
      el.scrollTop = top + (el.scrollHeight - height)
      savedScrollRef.current = null
      loadingOlderRef.current = false
    } else if (isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return

    const { scrollTop, scrollHeight, clientHeight } = el
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 100

    if (
      scrollTop < 200 &&
      hasNextPage &&
      !isFetchingNextPage &&
      !loadingOlderRef.current
    ) {
      savedScrollRef.current = { height: scrollHeight, top: scrollTop }
      loadingOlderRef.current = true
      fetchNextPage()
    }
  }

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
          <h2 className="font-semibold text-gray-900 text-sm truncate">
            {displayName}
          </h2>
          <p className="text-xs text-gray-500">
            {chat.is_group ? 'Group chat' : 'Private chat'}
          </p>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ backgroundColor: '#efeae2' }}
      >
        {isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        )}
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

      {/* Message input */}
      <MessageInput chatId={chat.chat_id!} />
    </div>
  )
}

function MessageInput({ chatId }: { chatId: string }) {
  const [text, setText] = useState('')

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase
        .from('outgoing_messages')
        .insert({ chat_id: chatId, content })
      if (error) throw error
    },
    onSuccess: () => setText(''),
  })

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || sendMutation.isPending) return
    sendMutation.mutate(trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
      style={{ backgroundColor: '#f0f2f5' }}
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message"
        disabled={sendMutation.isPending}
        className="flex-1 bg-white rounded-full px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-1 focus:ring-[#00a884]"
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={!text.trim() || sendMutation.isPending}
        className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: '#00a884' }}
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  )
}
