import { useEffect } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Message = Database['public']['Views']['messages']['Row']

const PAGE_SIZE = 20

export function useMessages(chatId: string | undefined) {
  const queryClient = useQueryClient()

  const {
    data: messages = [],
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['messages', chatId],
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId!)
        .order('timestamp', { ascending: false })
        .limit(PAGE_SIZE)

      if (pageParam) {
        query = query.lt('timestamp', pageParam)
      }

      const { data: rows } = await query
      return rows ?? []
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < PAGE_SIZE) return undefined
      return lastPage[lastPage.length - 1]?.timestamp ?? undefined
    },
    enabled: !!chatId,
    select: (d) => d.pages.flat().reverse(),
  })

  // Subscribe to realtime message broadcasts for the selected chat
  useEffect(() => {
    if (!chatId) return

    const channel = supabase
      .channel(`chat:${chatId}`, { config: { private: true } })
      .on('broadcast', { event: 'INSERT' }, (payload) => {
        const record = payload.payload?.record as Message | undefined
        if (!record) return
        queryClient.setQueryData<InfiniteData<Message[], string | undefined>>(
          ['messages', chatId],
          (old) => {
            if (!old) return old
            const firstPage = old.pages[0] ?? []
            if (
              firstPage.some(
                (m) =>
                  m.message_id === record.message_id &&
                  m.chat_id === record.chat_id,
              )
            )
              return old
            return {
              ...old,
              pages: [[record, ...firstPage], ...old.pages.slice(1)],
            }
          },
        )
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [chatId, queryClient])

  return {
    messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  }
}
