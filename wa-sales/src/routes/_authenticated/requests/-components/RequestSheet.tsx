import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  ClipboardCheck,
  Copy,
  Pencil,
  TicketCheck,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

type FlightRequest = Database['public']['Tables']['flight_requests']['Row']

const requestSchema = z.object({
  origin: z.string().optional(),
  destination: z.string().optional(),
  departure_date_start: z.string().optional(),
  departure_date_end: z.string().optional(),
  return_date_start: z.string().optional(),
  return_date_end: z.string().optional(),
  adults: z.number().int().min(0).default(1),
  children: z.number().int().min(0).default(0),
  infants: z.number().int().min(0).default(0),
  cabin_class: z.string().default('economy'),
  budget_min: z.number().nullable().optional(),
  budget_max: z.number().nullable().optional(),
  budget_currency: z.string().default('BRL'),
  status: z.string().default('new'),
  notes: z.string().optional(),
})

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
  onDelete?: (id: string) => void
  onCreateBooking?: (flightRequestId: string, customerId: string) => void
}

export function RequestSheet({
  open,
  onOpenChange,
  customerId,
  chatId,
  request,
  onSaved,
  onDelete,
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
            onDelete={onDelete}
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
  onDelete,
  onCreateBooking,
}: {
  customerId: string
  chatId?: string | null
  request: FlightRequest | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  onDelete?: (id: string) => void
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
  const [quoteRefreshKey, setQuoteRefreshKey] = useState(0)
  const [linkedPassengerIds, setLinkedPassengerIds] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  const form = useForm({
    defaultValues: {
      origin: request?.origin ?? '',
      destination: request?.destination ?? '',
      departure_date_start: request?.departure_date_start ?? '',
      departure_date_end: request?.departure_date_end ?? '',
      return_date_start: request?.return_date_start ?? '',
      return_date_end: request?.return_date_end ?? '',
      adults: request?.adults ?? 1,
      children: request?.children ?? 0,
      infants: request?.infants ?? 0,
      cabin_class: request?.cabin_class ?? 'economy',
      budget_min: request?.budget_min ?? null,
      budget_max: request?.budget_max ?? null,
      budget_currency: request?.budget_currency ?? 'BRL',
      status: request?.status ?? 'new',
      notes: request?.notes ?? '',
    },
    onSubmit: async ({ value }) => {
      const parsed = requestSchema.safeParse(value)
      if (!parsed.success) return

      const payload = {
        customer_id: customerId,
        chat_id: chatId ?? null,
        origin: parsed.data.origin || null,
        destination: parsed.data.destination || null,
        departure_date_start: parsed.data.departure_date_start || null,
        departure_date_end: parsed.data.departure_date_end || null,
        return_date_start: parsed.data.return_date_start || null,
        return_date_end: parsed.data.return_date_end || null,
        adults: parsed.data.adults,
        children: parsed.data.children,
        infants: parsed.data.infants,
        cabin_class: parsed.data.cabin_class,
        budget_min: parsed.data.budget_min,
        budget_max: parsed.data.budget_max,
        budget_currency: parsed.data.budget_currency || 'BRL',
        status: parsed.data.status,
        notes: parsed.data.notes || null,
      }

      if (requestProp?.id) {
        const { error } = await supabase
          .from('flight_requests')
          .update(payload)
          .eq('id', requestProp.id)
        if (error) {
          console.error('Error updating request:', error)
          return
        }
        onSaved()
      } else {
        const { data, error } = await supabase
          .from('flight_requests')
          .insert(payload)
          .select()
          .single()
        if (error) {
          console.error('Error creating request:', error)
          return
        }
        setCreatedRequest(data as unknown as FlightRequest)
        setViewMode('summary')
      }
    },
  })

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

  // Summary mode for editing
  if (isEditing && viewMode === 'summary' && request.id) {
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
      paxParts.push(
        `${request.infants} infant${request.infants > 1 ? 's' : ''}`,
      )
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
              refreshKey={quoteRefreshKey}
              onStatusChange={() => onSaved()}
              chatId={chatId}
              origin={request.origin}
              destination={request.destination}
            />
          </div>

          {/* Footer */}
          <SheetFooter className="mt-auto px-0">
            <div className="flex w-full items-center justify-between">
              {onDelete ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => onDelete(request.id)}
                >
                  Delete
                </Button>
              ) : (
                <div />
              )}
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

  // Form mode (create or edit-form)
  return (
    <>
      <SheetHeader>
        <SheetTitle>
          {isEditing ? 'Edit Flight Request' : 'New Flight Request'}
        </SheetTitle>
        <SheetDescription>
          {isEditing
            ? 'Update the flight request details below.'
            : 'Fill in the details to create a new flight request.'}
        </SheetDescription>
      </SheetHeader>

      <form
        className="flex flex-1 flex-col gap-4 px-4"
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        {isEditing && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setViewMode('summary')}
          >
            <ArrowLeft className="size-3" />
            Back to summary
          </Button>
        )}

        {/* Route */}
        <div className="grid grid-cols-2 gap-2">
          <form.Field name="origin">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor="origin">Origin</Label>
                <Input
                  id="origin"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="e.g. GRU"
                />
              </div>
            )}
          </form.Field>
          <form.Field name="destination">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor="destination">Destination</Label>
                <Input
                  id="destination"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="e.g. CDG"
                />
              </div>
            )}
          </form.Field>
        </div>

        {/* Departure dates */}
        <div className="grid grid-cols-2 gap-2">
          <form.Field name="departure_date_start">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor="dep_start">Departure from</Label>
                <Input
                  id="dep_start"
                  type="date"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="departure_date_end">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor="dep_end">Departure to</Label>
                <Input
                  id="dep_end"
                  type="date"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
        </div>

        {/* Return dates */}
        <div className="grid grid-cols-2 gap-2">
          <form.Field name="return_date_start">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor="ret_start">Return from</Label>
                <Input
                  id="ret_start"
                  type="date"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="return_date_end">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor="ret_end">Return to</Label>
                <Input
                  id="ret_end"
                  type="date"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
        </div>

        {/* Passengers count */}
        <div className="grid grid-cols-3 gap-2">
          <form.Field name="adults">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor="adults">Adults</Label>
                <Input
                  id="adults"
                  type="number"
                  min={0}
                  value={field.state.value}
                  onChange={(e) =>
                    field.handleChange(parseInt(e.target.value) || 0)
                  }
                />
              </div>
            )}
          </form.Field>
          <form.Field name="children">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor="children">Children</Label>
                <Input
                  id="children"
                  type="number"
                  min={0}
                  value={field.state.value}
                  onChange={(e) =>
                    field.handleChange(parseInt(e.target.value) || 0)
                  }
                />
              </div>
            )}
          </form.Field>
          <form.Field name="infants">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor="infants">Infants</Label>
                <Input
                  id="infants"
                  type="number"
                  min={0}
                  value={field.state.value}
                  onChange={(e) =>
                    field.handleChange(parseInt(e.target.value) || 0)
                  }
                />
              </div>
            )}
          </form.Field>
        </div>

        {/* Cabin class */}
        <form.Field name="cabin_class">
          {(field) => (
            <div className="flex flex-col gap-1">
              <Label>Cabin Class</Label>
              <Select
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="economy">Economy</SelectItem>
                  <SelectItem value="premium_economy">
                    Premium Economy
                  </SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="first">First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>

        {/* Budget */}
        <div className="grid grid-cols-3 gap-2">
          <form.Field name="budget_min">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor="budget_min">Budget Min</Label>
                <Input
                  id="budget_min"
                  type="number"
                  step="0.01"
                  value={field.state.value ?? ''}
                  onChange={(e) =>
                    field.handleChange(
                      e.target.value ? parseFloat(e.target.value) : null,
                    )
                  }
                />
              </div>
            )}
          </form.Field>
          <form.Field name="budget_max">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor="budget_max">Budget Max</Label>
                <Input
                  id="budget_max"
                  type="number"
                  step="0.01"
                  value={field.state.value ?? ''}
                  onChange={(e) =>
                    field.handleChange(
                      e.target.value ? parseFloat(e.target.value) : null,
                    )
                  }
                />
              </div>
            )}
          </form.Field>
          <form.Field name="budget_currency">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor="budget_currency">Currency</Label>
                <Input
                  id="budget_currency"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
        </div>

        {/* Status (edit only) */}
        {isEditing && (
          <form.Field name="status">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label>Status</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="quoted">Quoted</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
        )}

        {/* Notes */}
        <form.Field name="notes">
          {(field) => (
            <div className="flex flex-col gap-1">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Optional notes..."
                rows={3}
              />
            </div>
          )}
        </form.Field>

        <SheetFooter className="mt-auto px-0">
          <div className="flex w-full items-center justify-between">
            <div />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  isEditing ? setViewMode('summary') : onOpenChange(false)
                }
              >
                Cancel
              </Button>
              <Button type="submit">{isEditing ? 'Save' : 'Create'}</Button>
            </div>
          </div>
        </SheetFooter>
      </form>
    </>
  )
}
