import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useMediaUrl } from '@/hooks/useMediaUrl'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Document = Database['public']['Tables']['documents']['Row']

const TYPE_COLORS: Record<string, string> = {
  passport: 'bg-blue-600 text-white',
  id_card: 'bg-indigo-600 text-white',
  cpf: 'bg-violet-600 text-white',
  receipt: 'bg-green-600 text-white',
  voucher: 'bg-amber-600 text-white',
  itinerary: 'bg-cyan-600 text-white',
  other: 'bg-gray-500 text-white',
}

const TYPE_LABELS: Record<string, string> = {
  passport: 'Passport',
  id_card: 'ID Card',
  cpf: 'CPF',
  receipt: 'Receipt',
  voucher: 'Voucher',
  itinerary: 'Itinerary',
  other: 'Other',
}

interface DocumentListProps {
  passengerId?: string
  chatId?: string
  refreshKey: number
  onChanged?: () => void
}

export function DocumentList({
  passengerId,
  chatId,
  refreshKey,
  onChanged,
}: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctrl = { cancelled: false }

    async function load() {
      setLoading(true)
      let query = supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })

      if (passengerId) {
        query = query.eq('passenger_id', passengerId)
      } else if (chatId) {
        query = query.eq('chat_id', chatId)
      }

      const { data } = await query

      if (!ctrl.cancelled) {
        setDocuments(data ?? [])
        setLoading(false)
      }
    }

    load()
    return () => {
      ctrl.cancelled = true
    }
  }, [passengerId, chatId, refreshKey])

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading documents...</p>
  }

  if (documents.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No documents tagged yet.</p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {documents.map((doc) => (
        <DocumentRow key={doc.id} document={doc} />
      ))}
    </div>
  )
}

function DocumentRow({ document: doc }: { document: Document }) {
  const isImage = doc.storage_path.match(/\.(jpg|jpeg|png|webp|gif)$/i)
  const { url } = useMediaUrl(doc.storage_path)

  return (
    <div className="flex items-center gap-3 rounded-md border p-2">
      {/* Thumbnail */}
      {isImage && url ? (
        <img
          src={url}
          alt=""
          className="size-12 shrink-0 rounded object-cover"
        />
      ) : (
        <div className="bg-muted flex size-12 shrink-0 items-center justify-center rounded">
          <span className="text-muted-foreground text-xs">File</span>
        </div>
      )}

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <Badge
            className={TYPE_COLORS[doc.document_type] ?? TYPE_COLORS.other}
          >
            {TYPE_LABELS[doc.document_type] ?? doc.document_type}
          </Badge>
          {doc.label && (
            <span className="text-muted-foreground truncate text-xs">
              {doc.label}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 gap-1">
        {url && (
          <Button type="button" variant="ghost" size="icon" asChild>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title="View"
            >
              <ExternalLink className="size-4" />
            </a>
          </Button>
        )}
      </div>
    </div>
  )
}
