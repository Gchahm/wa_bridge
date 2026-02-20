import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Pause, Play } from 'lucide-react'
import { useMediaUrl } from '@/hooks/useMediaUrl'
import { Slider } from '@/components/ui/slider'

// Module-level ref to track the currently playing audio element,
// so only one audio plays at a time across the entire chat.
let currentlyPlaying: HTMLAudioElement | null = null

const SPEED_OPTIONS = [1, 1.5, 2] as const

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

type AudioPlayerProps = {
  mediaPath: string
}

export function AudioPlayer({ mediaPath }: AudioPlayerProps) {
  const { url, isLoading: urlLoading } = useMediaUrl(mediaPath)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [speedIndex, setSpeedIndex] = useState(0)

  const speed = SPEED_OPTIONS[speedIndex]

  // Sync playback rate when speed changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed
    }
  }, [speed])

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.pause()
    } else {
      // Pause any other playing audio
      if (currentlyPlaying && currentlyPlaying !== audio) {
        currentlyPlaying.pause()
      }
      currentlyPlaying = audio
      audio.playbackRate = speed
      audio.play()
    }
  }, [playing, speed])

  const handleSeek = useCallback((value: number[]) => {
    const audio = audioRef.current
    if (!audio || (!value[0] && value[0] !== 0)) return
    audio.currentTime = value[0]
    setCurrentTime(value[0])
  }, [])

  const toggleSpeed = useCallback(() => {
    setSpeedIndex((i) => (i + 1) % SPEED_OPTIONS.length)
  }, [])

  // Attach audio element event listeners
  useEffect(() => {
    if (!url) return

    const audio = new Audio(url)
    audioRef.current = audio

    const onLoadedMetadata = () => setDuration(audio.duration)
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      setPlaying(false)
      setCurrentTime(0)
      if (currentlyPlaying === audio) currentlyPlaying = null
    }

    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.pause()
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      if (currentlyPlaying === audio) currentlyPlaying = null
      audioRef.current = null
    }
  }, [url])

  if (urlLoading || !url) {
    return (
      <div className="flex items-center gap-2 py-1">
        <Loader2 className="size-5 animate-spin text-gray-400" />
        <span className="text-xs text-gray-400">Loading audio...</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 py-1 min-w-[220px]">
      {/* Play / Pause */}
      <button
        type="button"
        onClick={handlePlayPause}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white hover:bg-[#009174] transition-colors"
      >
        {playing ? (
          <Pause className="size-4" />
        ) : (
          <Play className="size-4 ml-0.5" />
        )}
      </button>

      {/* Progress slider */}
      <Slider
        min={0}
        max={duration || 1}
        step={0.1}
        value={[currentTime]}
        onValueChange={handleSeek}
        className="flex-1 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-range]]:bg-[#00a884] [&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-thumb]]:border-[#00a884]"
      />

      {/* Duration */}
      <span className="shrink-0 text-[11px] tabular-nums text-gray-500 min-w-[70px] text-center">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      {/* Speed toggle */}
      <button
        type="button"
        onClick={toggleSpeed}
        className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-gray-500 hover:bg-black/5 transition-colors"
      >
        {speed}x
      </button>
    </div>
  )
}
