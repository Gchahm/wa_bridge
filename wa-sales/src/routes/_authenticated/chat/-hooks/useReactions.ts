import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Reaction = Database['public']['Views']['reactions']['Row']

export function useReactions(chatId: string | undefined) {
  const queryClient = useQueryClient()

  const { data: reactions = [] } = useQuery({
    queryKey: ['reactions', chatId],
    queryFn: async () => {
      const { data } = await supabase
        .from('reactions')
        .select('*')
        .eq('chat_id', chatId!)
      return data ?? []
    },
    enabled: !!chatId,
  })

  // Subscribe to realtime reaction broadcasts for the selected chat
  useEffect(() => {
    if (!chatId) return

    const channel = supabase
      .channel(`reactions:${chatId}`, { config: { private: true } })
      .on('broadcast', { event: '*' }, () => {
        queryClient.invalidateQueries({ queryKey: ['reactions', chatId] })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [chatId, queryClient])

  // Build a Map<message_id, Reaction[]> for efficient lookup
  const reactionsMap = useMemo(() => {
    const map = new Map<string, Reaction[]>()
    for (const r of reactions) {
      if (!r.message_id) continue
      const existing = map.get(r.message_id)
      if (existing) {
        existing.push(r)
      } else {
        map.set(r.message_id, [r])
      }
    }
    return map
  }, [reactions])

  return reactionsMap
}

export type { Reaction }
