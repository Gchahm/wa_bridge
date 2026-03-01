import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { RequestBookingSheets } from './RequestBookingSheets'

type FlightRequest = Database['public']['Tables']['flight_requests']['Row']

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  quoted: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-green-100 text-green-800',
  booked: 'bg-purple-100 text-purple-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
}

interface RequestsForCustomerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  chatId?: string | null
}

export function RequestsForCustomerSheet({
  open,
  onOpenChange,
  customerId,
  chatId,
}: RequestsForCustomerSheetProps) {
  const [requests, setRequests] = useState<FlightRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [requestSheetOpen, setRequestSheetOpen] = useState(false)
  const [editingRequest, setEditingRequest] = useState<FlightRequest | null>(
    null,
  )

  useEffect(() => {
    if (!open) return

    const ctrl = { cancelled: false }

    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('flight_requests')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      if (!ctrl.cancelled) {
        setRequests(data ?? [])
        setLoading(false)
      }
    }

    load()
    return () => {
      ctrl.cancelled = true
    }
  }, [open, customerId, refreshKey])

  function handleCreate() {
    setEditingRequest(null)
    setRequestSheetOpen(true)
  }

  function handleEdit(request: FlightRequest) {
    setEditingRequest(request)
    setRequestSheetOpen(true)
  }

  function formatDateRange(start: string | null, end: string | null) {
    if (!start && !end) return null
    const fmt = (d: string) => {
      try {
        return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
      } catch {
        return d
      }
    }
    if (start && end) return `${fmt(start)} – ${fmt(end)}`
    return fmt(start ?? end!)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Flight Requests</SheetTitle>
          <SheetDescription>
            Manage flight requests for this customer.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 px-4">
          <Button onClick={handleCreate} className="self-start">
            <Plus className="size-4" />
            New Request
          </Button>

          {loading && (
            <p className="text-muted-foreground text-sm">Loading...</p>
          )}

          {!loading && requests.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No flight requests yet.
            </p>
          )}

          {requests.map((req) => (
            <div
              key={req.id}
              className="cursor-pointer rounded-md border p-3 transition-colors hover:bg-accent"
              onClick={() => handleEdit(req)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {req.origin || '?'} → {req.destination || '?'}
                  </span>
                  <Badge
                    className={statusColors[req.status]}
                    variant="secondary"
                  >
                    {req.status}
                  </Badge>
                </div>
              </div>
              {(req.departure_date_start || req.departure_date_end) && (
                <p className="text-muted-foreground mt-1 text-xs">
                  Dep:{' '}
                  {formatDateRange(
                    req.departure_date_start,
                    req.departure_date_end,
                  )}
                </p>
              )}
              {(req.return_date_start || req.return_date_end) && (
                <p className="text-muted-foreground text-xs">
                  Ret:{' '}
                  {formatDateRange(req.return_date_start, req.return_date_end)}
                </p>
              )}
              <p className="text-muted-foreground mt-1 text-xs">
                {(req.adults ?? 0) + (req.children ?? 0) + (req.infants ?? 0)}{' '}
                pax · {req.cabin_class}
              </p>
            </div>
          ))}
        </div>

        <RequestBookingSheets
          open={requestSheetOpen}
          onOpenChange={setRequestSheetOpen}
          customerId={customerId}
          chatId={chatId}
          request={editingRequest}
          onChanged={() => {
            setEditingRequest(null)
            setRefreshKey((k) => k + 1)
          }}
        />
      </SheetContent>
    </Sheet>
  )
}
