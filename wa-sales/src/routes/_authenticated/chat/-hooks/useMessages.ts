import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Message = Database['public']['Views']['messages']['Row']

export function useMessages(chatId: string | undefined) {
  const queryClient = useQueryClient()

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', chatId],
    queryFn: () =>
      supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId!)
        .order('timestamp', { ascending: true })
        .limit(200)
        .then(({ data }) => data ?? []),
    enabled: !!chatId,
  })

  // Subscribe to realtime message broadcasts for the selected chat
  useEffect(() => {
    if (!chatId) return

    const channel = supabase
      .channel(`chat:${chatId}`, { config: { private: true } })
      .on('broadcast', { event: 'INSERT' }, (payload) => {
        const record = payload.payload?.record as Message | undefined
        if (!record) return
        queryClient.setQueryData(
          ['messages', chatId],
          (old: Message[] = []) => {
            if (
              old.some(
                (m) =>
                  m.message_id === record.message_id &&
                  m.chat_id === record.chat_id,
              )
            )
              return old
            return [...old, record]
          },
        )
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [chatId, queryClient])

  return messages
}
