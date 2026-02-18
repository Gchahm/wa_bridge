import { Store } from '@tanstack/store'
import type { ChatWithPreview } from '@/components/ChatItem'
import type { Database } from '@/lib/database.types'

type Chat = Database['wa_bridge']['Tables']['chats']['Row']

type BroadcastPayload = {
  record: Chat
  old_record: Chat
}

export const chatStore = new Store<{ chats: ChatWithPreview[] }>({ chats: [] })

export function initChatStore(chats: ChatWithPreview[]) {
  chatStore.setState(() => ({ chats }))
}

export function handleChatInsert(payload: BroadcastPayload) {
  const record = payload.record
  const chat: ChatWithPreview = {
    chat_id: record.chat_id,
    name: record.name,
    is_group: record.is_group,
    created_at: record.created_at,
    last_message_at: record.last_message_at,
    last_message_content: null,
    last_message_timestamp: record.last_message_at,
    last_message_type: null,
    last_message_is_from_me: null,
  }
  chatStore.setState((prev) => ({ chats: [chat, ...prev.chats] }))
}

export function handleChatUpdate(payload: BroadcastPayload) {
  const record = payload.record
  if (!record.chat_id) return

  chatStore.setState((prev) => {
    const chats = prev.chats.map((c) => {
      if (c.chat_id !== record.chat_id) return c
      return {
        ...c,
        name: record.name ?? c.name,
        is_group: record.is_group,
        last_message_at: record.last_message_at ?? c.last_message_at,
        last_message_timestamp:
          record.last_message_at ?? c.last_message_timestamp,
      }
    })
    chats.sort((a, b) => {
      const ta = a.last_message_timestamp ?? a.last_message_at ?? ''
      const tb = b.last_message_timestamp ?? b.last_message_at ?? ''
      return tb.localeCompare(ta)
    })
    return { chats }
  })
}

export function handleChatDelete(payload: BroadcastPayload) {
  const chatId = payload.old_record.chat_id
  if (!chatId) return
  chatStore.setState((prev) => ({
    chats: prev.chats.filter((c) => c.chat_id !== chatId),
  }))
}
