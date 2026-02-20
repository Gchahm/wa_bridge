import { useCallback, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { useMediaUrl } from '@/hooks/useMediaUrl'

type MessageImageProps = {
  mediaPath: string
}

export function MessageImage({ mediaPath }: MessageImageProps) {
  const { url, isLoading } = useMediaUrl(mediaPath)
  const [lightbox, setLightbox] = useState(false)

  const openLightbox = useCallback(() => setLightbox(true), [])
  const closeLightbox = useCallback(() => setLightbox(false), [])

  if (isLoading || !url) {
    return (
      <div className="flex items-center justify-center rounded bg-black/5 h-48 w-full">
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={openLightbox}
        className="block -mx-3 -mt-2 cursor-pointer"
      >
        <img
          src={url}
          alt=""
          className="rounded-t-lg max-h-80 w-full object-cover"
          loading="lazy"
        />
      </button>

      {/* Fullscreen lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="size-8" />
          </button>
          <img
            src={url}
            alt=""
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
