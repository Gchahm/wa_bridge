import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Database } from '@/lib/database.types'
import { AudioPlayer } from '@/components/AudioPlayer'
import { MessageImage } from '@/components/MessageImage'

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
  const messageDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  )

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
  quotedMessage?: Message | null
  isGroup: boolean
  showDateSeparator: boolean
}

export function MessageBubble({
  message,
  quotedMessage,
  isGroup,
  showDateSeparator,
}: MessageBubbleProps) {
  const isFromMe = message.is_from_me ?? false
  const time = formatMessageTime(message.timestamp)
  const dateLabel =
    showDateSeparator && message.timestamp
      ? formatDateSeparator(message.timestamp)
      : null

  const isAudio = message.media_type === 'audio' && !!message.media_path
  const isImage = message.media_type === 'image' && !!message.media_path
  const hasInlineMedia = isAudio || isImage
  const isMedia =
    message.message_type !== 'text' && message.message_type !== 'chat'
  const contentText = hasInlineMedia
    ? message.content || ''
    : message.content ||
      (isMedia ? `[${message.media_type || message.message_type}]` : '')

  return (
    <>
      {dateLabel && (
        <div className="flex items-center justify-center my-4">
          <span className="px-3 py-1 text-xs text-gray-600 bg-white rounded-full shadow-sm">
            {dateLabel}
          </span>
        </div>
      )}

      <div
        className={`flex mb-1 ${isFromMe ? 'justify-end' : 'justify-start'}`}
      >
        <div
          className={`max-w-[65%] min-w-[80px] rounded-lg px-3 py-2 shadow-sm relative ${
            isFromMe ? 'rounded-br-sm' : 'rounded-bl-sm'
          }`}
          style={{
            backgroundColor: isFromMe ? '#d9fdd3' : '#ffffff',
          }}
        >
          {/* Sender name for group chats (non-me messages) */}
          {isGroup &&
            !isFromMe &&
            (message.sender_name || message.sender_id) && (
              <p
                className="text-xs font-semibold mb-1"
                style={{ color: '#00a884' }}
              >
                {message.sender_name || message.sender_id}
              </p>
            )}

          {/* Quoted message preview */}
          {quotedMessage && (
            <div className="mb-1 rounded bg-black/5 border-l-2 border-[#00a884] px-2 py-1">
              <p className="text-xs font-semibold text-[#00a884] truncate">
                {quotedMessage.sender_name || quotedMessage.sender_id || 'You'}
              </p>
              <p className="text-xs text-gray-600 truncate">
                {quotedMessage.content ||
                  `[${quotedMessage.media_type || quotedMessage.message_type}]`}
              </p>
            </div>
          )}

          {/* Inline media */}
          {isImage && <MessageImage mediaPath={message.media_path!} />}
          {isAudio && <AudioPlayer mediaPath={message.media_path!} />}

          {/* Message content */}
          {contentText ? (
            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
              {contentText}
            </p>
          ) : !hasInlineMedia ? (
            <p className="text-sm text-gray-400 italic">
              [{message.message_type}]
            </p>
          ) : null}

          {/* Description toggle */}
          {message.description && (
            <DescriptionToggle description={message.description} />
          )}

          {/* Timestamp */}
          <div
            className={`flex items-center gap-1 mt-1 ${isFromMe ? 'justify-end' : 'justify-start'}`}
          >
            <span className="text-[10px] text-gray-500 leading-none">
              {time}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

function DescriptionToggle({ description }: { description: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 transition-colors"
      >
        {open ? (
          <ChevronUp className="size-3" />
        ) : (
          <ChevronDown className="size-3" />
        )}
        <span>Description</span>
      </button>
      {open && (
        <p className="mt-1 text-xs text-gray-600 whitespace-pre-wrap break-words">
          {description}
        </p>
      )}
    </div>
  )
}

export { getMessageDateKey }
