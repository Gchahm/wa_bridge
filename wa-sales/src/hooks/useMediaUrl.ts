import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useMediaUrl(mediaPath: string | null | undefined) {
  const {
    data: url,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['media-url', mediaPath],
    queryFn: async () => {
      const { data: result, error: storageError } = await supabase.storage
        .from('wa-media')
        .createSignedUrl(mediaPath!, 3600)
      if (storageError) throw storageError
      return result.signedUrl
    },
    enabled: !!mediaPath,
    staleTime: 55 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })

  return { url: url ?? null, isLoading, error }
}
