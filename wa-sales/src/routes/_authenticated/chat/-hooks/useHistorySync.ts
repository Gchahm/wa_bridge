import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type BridgeCommand = Database['public']['Views']['bridge_commands']['Row']
type CommandStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed'

export function useHistorySync(chatId: string | undefined) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<CommandStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Reset status when chatId changes
  useEffect(() => {
    setStatus('idle')
    setErrorMessage(null)
  }, [chatId])

  // Realtime subscription for command status updates
  useEffect(() => {
    if (!chatId) return

    const channel = supabase
      .channel(`commands:${chatId}`, { config: { private: true } })
      .on('broadcast', { event: 'INSERT' }, (payload) => {
        const record = payload.payload?.record as BridgeCommand | undefined
        if (!record) return
        if (record.status === 'processing') {
          setStatus('processing')
        } else if (record.status === 'completed') {
          setStatus('completed')
          queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
          setTimeout(() => setStatus('idle'), 2000)
        } else if (record.status === 'failed') {
          setStatus('failed')
          setErrorMessage(record.error_message ?? null)
          setTimeout(() => {
            setStatus('idle')
            setErrorMessage(null)
          }, 5000)
        }
      })
      .on('broadcast', { event: 'UPDATE' }, (payload) => {
        const record = payload.payload?.record as BridgeCommand | undefined
        if (!record) return
        if (record.status === 'processing') {
          setStatus('processing')
        } else if (record.status === 'completed') {
          setStatus('completed')
          queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
          setTimeout(() => setStatus('idle'), 2000)
        } else if (record.status === 'failed') {
          setStatus('failed')
          setErrorMessage(record.error_message ?? null)
          setTimeout(() => {
            setStatus('idle')
            setErrorMessage(null)
          }, 5000)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [chatId, queryClient])

  const requestSync = useCallback(async () => {
    if (!chatId) return

    // Check for existing pending/processing command for this chat
    const { data: existing } = await supabase
      .from('bridge_commands')
      .select('id')
      .eq('chat_id', chatId)
      .in('status', ['pending', 'processing'])
      .limit(1)

    if (existing && existing.length > 0) {
      // Already in progress, skip
      return
    }

    // Query the oldest message for this chat
    const { data: oldestMessages } = await supabase
      .from('messages')
      .select('message_id, timestamp')
      .eq('chat_id', chatId)
      .order('timestamp', { ascending: true })
      .limit(1)

    const oldestMessage = oldestMessages?.[0]

    // INSERT into bridge_commands
    await supabase.from('bridge_commands').insert({
      command_type: 'history_sync',
      chat_id: chatId,
      payload: {
        oldest_message_id: oldestMessage?.message_id ?? null,
        oldest_timestamp: oldestMessage?.timestamp ?? null,
        count: 10,
      },
    })

    setStatus('pending')
  }, [chatId])

  const isLoading = status === 'pending' || status === 'processing'

  return { status, errorMessage, requestSync, isLoading }
}
