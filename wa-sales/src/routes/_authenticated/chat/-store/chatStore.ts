import { Store } from '@tanstack/store'
import type { ChatWithPreview } from '@/components/ChatItem'
import type { Database } from '@/lib/database.types'

type Chat = Database['public']['Views']['chats']['Row']

type BroadcastPayload = {
  record: Chat
  old_record: Chat
}

export const chatStore = new Store<{ chats: ChatWithPreview[] }>({ chats: [] })

export function initChatStore(chats: ChatWithPreview[]) {
  chatStore.setState(() => ({ chats }))
}

export function handleChatInsert(payload: BroadcastPayload) {
  console.log('handleChatInsert', payload)
  const record = payload.record
  const chat: ChatWithPreview = {
    ...record,
    lastMessage: null,
    lastMessageAt: record.last_message_at,
  }
  chatStore.setState((prev) => ({ chats: [chat, ...prev.chats] }))
}

export function handleChatUpdate(payload: BroadcastPayload) {
  console.log('handleChatUpdate', payload)
  const record = payload.record
  if (!record.chat_id) return

  chatStore.setState((prev) => {
    const chats = prev.chats.map((c) => {
      if (c.chat_id !== record.chat_id) return c
      return {
        ...c,
        name: record.name ?? c.name,
        is_group: record.is_group ?? c.is_group,
        last_message_at: record.last_message_at ?? c.last_message_at,
        lastMessageAt: record.last_message_at ?? c.lastMessageAt,
      }
    })
    chats.sort((a, b) => {
      const ta = a.lastMessageAt ?? a.last_message_at ?? ''
      const tb = b.lastMessageAt ?? b.last_message_at ?? ''
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
