import type { Database } from '@/lib/database.types'

type Message = Database['public']['Views']['messages']['Row']

function formatMessageTime(timestamp: string | null): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatDateSeparator(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (messageDate.getTime() === today.getTime()) return 'Today'
  if (messageDate.getTime() === yesterday.getTime()) return 'Yesterday'

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

function getMessageDateKey(timestamp: string): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

type MessageBubbleProps = {
  message: Message
  isGroup: boolean
  showDateSeparator: boolean
}

export function MessageBubble({ message, isGroup, showDateSeparator }: MessageBubbleProps) {
  const isFromMe = message.is_from_me ?? false
  const time = formatMessageTime(message.timestamp)
  const dateLabel = showDateSeparator && message.timestamp
    ? formatDateSeparator(message.timestamp)
    : null

  const isMedia = message.message_type !== 'text' && message.message_type !== 'chat'
  const contentText = message.content || (isMedia ? `[${message.media_type || message.message_type}]` : '')

  return (
    <>
      {dateLabel && (
        <div className="flex items-center justify-center my-4">
          <span className="px-3 py-1 text-xs text-gray-600 bg-white rounded-full shadow-sm">
            {dateLabel}
          </span>
        </div>
      )}

      <div className={`flex mb-1 ${isFromMe ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[65%] min-w-[80px] rounded-lg px-3 py-2 shadow-sm relative ${
            isFromMe
              ? 'rounded-br-sm'
              : 'rounded-bl-sm'
          }`}
          style={{
            backgroundColor: isFromMe ? '#d9fdd3' : '#ffffff',
          }}
        >
          {/* Sender name for group chats (non-me messages) */}
          {isGroup && !isFromMe && (message.sender_name || message.sender_id) && (
            <p className="text-xs font-semibold mb-1" style={{ color: '#00a884' }}>
              {message.sender_name || message.sender_id}
            </p>
          )}

          {/* Message content */}
          {contentText ? (
            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
              {contentText}
            </p>
          ) : (
            <p className="text-sm text-gray-400 italic">
              [{message.message_type}]
            </p>
          )}

          {/* Timestamp */}
          <div className={`flex items-center gap-1 mt-1 ${isFromMe ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-gray-500 leading-none">{time}</span>
          </div>
        </div>
      </div>
    </>
  )
}

export { getMessageDateKey }
