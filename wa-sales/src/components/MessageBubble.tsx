import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Pencil, Tag } from 'lucide-react'
import type { Database } from '@/lib/database.types'
import { AudioPlayer } from '@/components/AudioPlayer'
import { MessageImage } from '@/components/MessageImage'
import { MessageSticker } from '@/components/MessageSticker'
import type { Reaction } from '@/routes/_authenticated/chat/-hooks/useReactions'

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
  reactions?: Reaction[]
  isGroup: boolean
  showDateSeparator: boolean
  onTagDocument?: (message: Message) => void
  isTagged?: boolean
}

export function MessageBubble({
  message,
  quotedMessage,
  reactions,
  isGroup,
  showDateSeparator,
  onTagDocument,
  isTagged,
}: MessageBubbleProps) {
  const isFromMe = message.is_from_me ?? false
  const time = formatMessageTime(message.timestamp)
  const dateLabel =
    showDateSeparator && message.timestamp
      ? formatDateSeparator(message.timestamp)
      : null

  const isAudio = message.media_type === 'audio' && !!message.media_path
  const isImage = message.media_type === 'image' && !!message.media_path
  const isSticker = message.media_type === 'sticker' && !!message.media_path
  const hasInlineMedia = isAudio || isImage || isSticker
  const isMedia =
    message.message_type !== 'text' && message.message_type !== 'chat'
  const contentText = hasInlineMedia
    ? message.content || ''
    : message.content ||
      (isMedia ? `[${message.media_type || message.message_type}]` : '')

  // Sticker messages render without a bubble background
  if (isSticker) {
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
          <div className="flex flex-col items-center gap-0.5">
            <MessageSticker mediaPath={message.media_path!} />
            {/* Reactions */}
            {reactions && reactions.length > 0 && (
              <ReactionBadges reactions={reactions} />
            )}
            <span className="text-[10px] text-gray-500 leading-none">
              {time}
            </span>
          </div>
        </div>
      </>
    )
  }

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

          {/* Edit history toggle */}
          {message.edit_history &&
            Array.isArray(message.edit_history) &&
            message.edit_history.length > 0 && (
              <EditHistoryToggle
                editHistory={
                  message.edit_history as {
                    content: string
                    edited_at: string
                  }[]
                }
              />
            )}

          {/* Reactions */}
          {reactions && reactions.length > 0 && (
            <ReactionBadges reactions={reactions} />
          )}

          {/* Timestamp */}
          <div
            className={`flex items-center gap-1 mt-1 ${isFromMe ? 'justify-end' : 'justify-start'}`}
          >
            {!!message.media_path &&
              (message.media_type === 'image' ||
                message.media_type === 'video' ||
                message.media_type === 'document') &&
              (isTagged ? (
                <Tag className="size-3 text-[#00a884]" />
              ) : (
                onTagDocument && (
                  <button
                    type="button"
                    onClick={() => onTagDocument(message)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title="Tag document"
                  >
                    <Tag className="size-3" />
                  </button>
                )
              ))}
            {message.edited_at && <Pencil className="size-2.5 text-gray-400" />}
            <span className="text-[10px] text-gray-500 leading-none">
              {time}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

function ReactionBadges({ reactions }: { reactions: Reaction[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const r of reactions) {
      if (!r.emoji) continue
      const senders = map.get(r.emoji)
      if (senders) {
        senders.push(r.sender_id ?? '')
      } else {
        map.set(r.emoji, [r.sender_id ?? ''])
      }
    }
    return map
  }, [reactions])

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {[...grouped.entries()].map(([emoji, senders]) => (
        <span
          key={emoji}
          title={senders.join(', ')}
          className="inline-flex items-center gap-0.5 rounded-full bg-black/5 px-1.5 py-0.5 text-xs leading-none"
        >
          <span>{emoji}</span>
          {senders.length > 1 && (
            <span className="text-gray-500">{senders.length}</span>
          )}
        </span>
      ))}
    </div>
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

function EditHistoryToggle({
  editHistory,
}: {
  editHistory: { content: string; edited_at: string }[]
}) {
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
        <span>
          Edited {editHistory.length}{' '}
          {editHistory.length === 1 ? 'time' : 'times'}
        </span>
      </button>
      {open && (
        <div className="mt-1 space-y-1.5">
          {[...editHistory].reverse().map((entry, i) => (
            <div key={i} className="text-xs text-gray-600">
              <span className="text-[10px] text-gray-400">
                {new Date(entry.edited_at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}
              </span>
              <p className="whitespace-pre-wrap break-words">
                {entry.content || (
                  <span className="italic text-gray-400">(empty)</span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export { getMessageDateKey }
