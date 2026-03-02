import { Loader2 } from 'lucide-react'
import { useMediaUrl } from '@/hooks/useMediaUrl'

type MessageStickerProps = {
  mediaPath: string
}

export function MessageSticker({ mediaPath }: MessageStickerProps) {
  const { url, isLoading } = useMediaUrl(mediaPath)

  if (isLoading || !url) {
    return (
      <div className="flex items-center justify-center h-32 w-32">
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <img
      src={url}
      alt="sticker"
      className="h-32 w-32 object-contain"
      loading="lazy"
    />
  )
}
