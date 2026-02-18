import type { Database } from '@/lib/database.types'

type Chat = Database['public']['Views']['chats']['Row']

export type ChatWithPreview = Chat & {
  lastMessage: string | null
  lastMessageAt: string | null
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return ''

  const date = new Date(dateStr)
  const now = new Date()

  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getInitials(name: string | null, chatId: string): string {
  const displayName = name || chatId
  const words = displayName.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return displayName.slice(0, 2).toUpperCase()
}

function getAvatarColor(chatId: string): string {
  const colors = [
    'bg-emerald-500',
    'bg-blue-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-rose-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-amber-500',
  ]
  let hash = 0
  for (let i = 0; i < chatId.length; i++) {
    hash = chatId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

type ChatItemProps = {
  chat: ChatWithPreview
  isActive: boolean
  onClick: () => void
}

export function ChatItem({ chat, isActive, onClick }: ChatItemProps) {
  const chatId = chat.chat_id ?? ''
  const displayName = chat.name || chatId
  const initials = getInitials(chat.name, chatId)
  const avatarColor = getAvatarColor(chatId)
  const relativeTime = formatRelativeTime(
    chat.lastMessageAt || chat.last_message_at,
  )

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-gray-100 transition-colors cursor-pointer text-left border-b border-gray-100 ${
        isActive ? 'bg-gray-100' : 'bg-white'
      }`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-12 h-12 rounded-full ${avatarColor} flex items-center justify-center text-white font-semibold text-sm`}
      >
        {initials}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-gray-900 text-sm truncate">
            {displayName}
          </span>
          {relativeTime && (
            <span className="flex-shrink-0 text-xs text-gray-500">
              {relativeTime}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <p className="text-sm text-gray-500 truncate">
            {chat.lastMessage || 'No messages yet'}
          </p>
        </div>
      </div>
    </button>
  )
}
