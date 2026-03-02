import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { ClipboardCheck, Copy, Pencil, TicketCheck } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { QuoteOptionList } from './QuoteOptionList'
import { RequestPassengerList } from './RequestPassengerList'
import { RequestPassengerSelect } from './RequestPassengerSelect'
import { RequestForm } from './RequestForm'

type FlightRequest = Database['public']['Tables']['flight_requests']['Row']

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  quoted: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-green-100 text-green-800',
  booked: 'bg-purple-100 text-purple-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
}

const cabinClassLabels: Record<string, string> = {
  economy: 'Economy',
  premium_economy: 'Premium Economy',
  business: 'Business',
  first: 'First',
}

interface RequestSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  chatId?: string | null
  request: FlightRequest | null
  onSaved: () => void
  onCreateBooking?: (flightRequestId: string, customerId: string) => void
}

export function RequestSheet({
  open,
  onOpenChange,
  customerId,
  chatId,
  request,
  onSaved,
  onCreateBooking,
}: RequestSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-y-auto sm:max-w-lg">
        {open && (
          <RequestSheetForm
            key={request?.id ?? 'new'}
            customerId={customerId}
            chatId={chatId}
            request={request}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
            onCreateBooking={onCreateBooking}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  const s = formatDate(start)
  const e = formatDate(end)
  if (!s && !e) return null
  if (s && e) return `${s} \u2013 ${e}`
  return s || e
}

function RequestSheetForm({
  customerId,
  chatId,
  request: requestProp,
  onOpenChange,
  onSaved,
  onCreateBooking,
}: {
  customerId: string
  chatId?: string | null
  request: FlightRequest | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  onCreateBooking?: (flightRequestId: string, customerId: string) => void
}) {
  const [createdRequest, setCreatedRequest] = useState<FlightRequest | null>(
    null,
  )
  const request = createdRequest ?? requestProp
  const isEditing = !!request

  const [viewMode, setViewMode] = useState<'summary' | 'form'>(
    requestProp ? 'summary' : 'form',
  )
  const [passengerRefreshKey, setPassengerRefreshKey] = useState(0)
  const [linkedPassengerIds, setLinkedPassengerIds] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  // Load linked passenger IDs for the exclude list
  useState(() => {
    if (!isEditing || !request.id) return
    supabase
      .from('flight_request_passengers')
      .select('passenger_id')
      .eq('flight_request_id', request.id)
      .then(({ data }) => {
        const ids = (data ?? []).map((j) => j.passenger_id)
        setLinkedPassengerIds(ids)
      })
  })

  function handlePassengerChanged() {
    setPassengerRefreshKey((k) => k + 1)
    // Refresh linked IDs
    if (request?.id) {
      supabase
        .from('flight_request_passengers')
        .select('passenger_id')
        .eq('flight_request_id', request.id)
        .then(({ data }) => {
          const ids = (data ?? []).map((j) => j.passenger_id)
          setLinkedPassengerIds(ids)
        })
    }
  }

  async function handleCopyForLLM() {
    if (!request) return
    const lines: string[] = ['Search for flights:']

    const origin = request.origin
    const destination = request.destination
    if (origin || destination)
      lines.push(`Route: ${origin || '???'} → ${destination || '???'}`)

    const depRange = formatDateRange(
      request.departure_date_start,
      request.departure_date_end,
    )
    if (depRange) lines.push(`Departure: ${depRange}`)

    const retRange = formatDateRange(
      request.return_date_start,
      request.return_date_end,
    )
    if (retRange) lines.push(`Return: ${retRange}`)

    const paxParts: string[] = []
    if (request.adults && request.adults > 0)
      paxParts.push(`${request.adults} adult${request.adults > 1 ? 's' : ''}`)
    if (request.children && request.children > 0)
      paxParts.push(
        `${request.children} child${request.children > 1 ? 'ren' : ''}`,
      )
    if (request.infants && request.infants > 0)
      paxParts.push(
        `${request.infants} infant${request.infants > 1 ? 's' : ''}`,
      )
    if (paxParts.length > 0) lines.push(`Passengers: ${paxParts.join(', ')}`)

    const cabinLabel =
      cabinClassLabels[request.cabin_class ?? 'economy'] ?? request.cabin_class
    if (cabinLabel) lines.push(`Cabin: ${cabinLabel}`)

    const hasBudget = request.budget_min != null || request.budget_max != null
    if (hasBudget) {
      const currency = request.budget_currency || 'BRL'
      const min =
        request.budget_min != null ? request.budget_min.toLocaleString() : '?'
      const max =
        request.budget_max != null ? request.budget_max.toLocaleString() : '?'
      lines.push(`Budget: ${currency} ${min} – ${max}`)
    }

    if (request.notes) lines.push(`Notes: ${request.notes}`)

    await navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Form mode (create or edit-form)
  if (!isEditing || viewMode === 'form') {
    return (
      <RequestForm
        customerId={customerId}
        chatId={chatId}
        request={request}
        onSaved={() => {
          onSaved()
          setViewMode('summary')
        }}
        onCreated={(created) => {
          setCreatedRequest(created)
          setViewMode('summary')
        }}
        onCancel={() =>
          isEditing ? setViewMode('summary') : onOpenChange(false)
        }
      />
    )
  }

  // Summary mode for editing
  const status = request.status
  const origin = request.origin || '???'
  const destination = request.destination || '???'
  const depRange = formatDateRange(
    request.departure_date_start,
    request.departure_date_end,
  )
  const retRange = formatDateRange(
    request.return_date_start,
    request.return_date_end,
  )

  const paxParts: string[] = []
  if (request.adults && request.adults > 0)
    paxParts.push(`${request.adults} adult${request.adults > 1 ? 's' : ''}`)
  if (request.children && request.children > 0)
    paxParts.push(
      `${request.children} child${request.children > 1 ? 'ren' : ''}`,
    )
  if (request.infants && request.infants > 0)
    paxParts.push(`${request.infants} infant${request.infants > 1 ? 's' : ''}`)
  const paxSummary = paxParts.join(', ') || 'No passengers'
  const cabinLabel =
    cabinClassLabels[request.cabin_class ?? 'economy'] ?? request.cabin_class

  const hasBudget = request.budget_min != null || request.budget_max != null
  const currency = request.budget_currency || 'BRL'

  return (
    <>
      <SheetHeader>
        <SheetTitle>Flight Request</SheetTitle>
        <SheetDescription>
          Request details, passengers, and quotes.
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-4 px-4">
        {/* Request summary card */}
        <div className="bg-muted/50 flex flex-col gap-2 rounded-lg border p-4">
          <div className="flex items-start justify-between">
            <p className="text-lg font-semibold">
              {origin} &rarr; {destination}
            </p>
            <Badge className={statusColors[status]} variant="secondary">
              {status}
            </Badge>
          </div>

          {depRange && (
            <p className="text-muted-foreground text-sm">Dep: {depRange}</p>
          )}
          {retRange && (
            <p className="text-muted-foreground text-sm">Ret: {retRange}</p>
          )}

          <p className="text-sm">
            {paxSummary} &middot; {cabinLabel}
          </p>

          {hasBudget && (
            <p className="text-muted-foreground text-sm">
              Budget: {currency}{' '}
              {request.budget_min != null
                ? request.budget_min.toLocaleString()
                : '?'}
              {' \u2013 '}
              {request.budget_max != null
                ? request.budget_max.toLocaleString()
                : '?'}
            </p>
          )}

          {request.notes && (
            <p className="text-muted-foreground text-sm">{request.notes}</p>
          )}

          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={handleCopyForLLM}>
              {copied ? (
                <ClipboardCheck className="size-3" />
              ) : (
                <Copy className="size-3" />
              )}
              {copied ? 'Copied' : 'Copy for LLM'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('form')}
            >
              <Pencil className="size-3" />
              Edit
            </Button>
          </div>
        </div>

        {/* Passengers */}
        <Separator />

        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium">Passengers</p>
            <p className="text-muted-foreground text-xs">
              Passengers travelling on this request.
            </p>
          </div>

          <RequestPassengerList
            flightRequestId={request.id}
            refreshKey={passengerRefreshKey}
            onUnlinked={handlePassengerChanged}
          />

          <RequestPassengerSelect
            flightRequestId={request.id}
            customerId={customerId}
            excludeIds={linkedPassengerIds}
            onLinked={handlePassengerChanged}
          />
        </div>

        {/* Quote Options */}
        <Separator />

        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium">Quote Options</p>
            <p className="text-muted-foreground text-xs">
              Price quotes for this request.
            </p>
          </div>

          <QuoteOptionList
            flightRequestId={request.id}
            onStatusChange={() => onSaved()}
            chatId={chatId}
            origin={request.origin}
            destination={request.destination}
          />
        </div>

        {/* Footer */}
        <SheetFooter className="mt-auto px-0">
          <div className="flex w-full items-center justify-end">
            <div className="flex gap-2">
              {onCreateBooking && ['accepted', 'booked'].includes(status) && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onCreateBooking(request.id, customerId)}
                >
                  <TicketCheck className="size-4" />
                  Create Booking
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </SheetFooter>
      </div>
    </>
  )
}
