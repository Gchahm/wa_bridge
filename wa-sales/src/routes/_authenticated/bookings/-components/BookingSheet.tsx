import { useEffect, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
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
import { SegmentList } from './SegmentList'
import { BookingPassengerList } from './BookingPassengerList'
import { BookingPassengerSelect } from './BookingPassengerSelect'
import { PaymentList } from './PaymentList'
import { CommissionSection } from './CommissionSection'

type Booking = Database['public']['Tables']['bookings']['Row']
type Customer = Database['public']['Tables']['customers']['Row']

const bookingSchema = z.object({
  pnr: z.string().optional(),
  booking_source: z.string().optional(),
  status: z.string().default('confirmed'),
  total_price: z.number().nullable().optional(),
  currency: z.string().default('BRL'),
  notes: z.string().optional(),
})

interface BookingSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string | null
  booking: Booking | null
  flightRequestId?: string | null
  onSaved: () => void
}

export function BookingSheet({
  open,
  onOpenChange,
  customerId,
  booking,
  flightRequestId,
  onSaved,
}: BookingSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-y-auto sm:max-w-lg">
        {open && (
          <BookingSheetForm
            key={booking?.id ?? 'new'}
            customerId={customerId}
            flightRequestId={flightRequestId}
            booking={booking}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function BookingSheetForm({
  customerId: initialCustomerId,
  flightRequestId,
  booking,
  onOpenChange,
  onSaved,
}: {
  customerId: string | null
  flightRequestId?: string | null
  booking: Booking | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const isEditing = !!booking

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    initialCustomerId ?? booking?.customer_id ?? null,
  )
  const [customers, setCustomers] = useState<Customer[]>([])
  const [passengerRefreshKey, setPassengerRefreshKey] = useState(0)
  const [segmentRefreshKey] = useState(0)
  const [paymentRefreshKey] = useState(0)
  const [commissionRefreshKey] = useState(0)
  const [linkedPassengerIds, setLinkedPassengerIds] = useState<string[]>([])

  // Load customers for the select dropdown (create mode only)
  useEffect(() => {
    if (isEditing) return
    supabase
      .from('customers')
      .select('*')
      .order('name', { ascending: true })
      .then(({ data }) => setCustomers(data ?? []))
  }, [isEditing])

  const form = useForm({
    defaultValues: {
      pnr: booking?.pnr ?? '',
      booking_source: booking?.booking_source ?? '',
      status: booking?.status ?? 'confirmed',
      total_price: booking?.total_price ?? null,
      currency: booking?.currency ?? 'BRL',
      notes: booking?.notes ?? '',
    },
    onSubmit: async ({ value }) => {
      const parsed = bookingSchema.safeParse(value)
      if (!parsed.success) return

      const customerId = selectedCustomerId
      if (!customerId) return

      const payload = {
        customer_id: customerId,
        flight_request_id:
          flightRequestId ?? booking?.flight_request_id ?? null,
        pnr: parsed.data.pnr || null,
        booking_source: parsed.data.booking_source || null,
        status: parsed.data.status,
        total_price: parsed.data.total_price,
        currency: parsed.data.currency || 'BRL',
        notes: parsed.data.notes || null,
      }

      if (isEditing && booking.id) {
        const { error } = await supabase
          .from('bookings')
          .update(payload)
          .eq('id', booking.id)
        if (error) {
          console.error('Error updating booking:', error)
          return
        }
      } else {
        const { error } = await supabase.from('bookings').insert(payload)
        if (error) {
          console.error('Error creating booking:', error)
          return
        }

        // Auto-update flight request status to 'booked'
        const linkedRequestId = flightRequestId ?? null
        if (linkedRequestId) {
          await supabase
            .from('flight_requests')
            .update({ status: 'booked' })
            .eq('id', linkedRequestId)
        }
      }

      onSaved()
    },
  })

  // Load linked passenger IDs for the exclude list
  useState(() => {
    if (!isEditing || !booking.id) return
    supabase
      .from('booking_passengers')
      .select('passenger_id')
      .eq('booking_id', booking.id)
      .then(({ data }) => {
        const ids = (data ?? []).map((j) => j.passenger_id)
        setLinkedPassengerIds(ids)
      })
  })

  function handlePassengerChanged() {
    setPassengerRefreshKey((k) => k + 1)
    if (booking?.id) {
      supabase
        .from('booking_passengers')
        .select('passenger_id')
        .eq('booking_id', booking.id)
        .then(({ data }) => {
          const ids = (data ?? []).map((j) => j.passenger_id)
          setLinkedPassengerIds(ids)
        })
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{isEditing ? 'Edit Booking' : 'New Booking'}</SheetTitle>
        <SheetDescription>
          {isEditing
            ? 'Update the booking details below.'
            : 'Fill in the details to create a new booking.'}
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
        {/* Customer select (create mode only) */}
        {!isEditing && (
          <div className="flex flex-col gap-1">
            <Label>Customer</Label>
            <Select
              value={selectedCustomerId ?? '__none__'}
              onValueChange={(v) =>
                setSelectedCustomerId(v === '__none__' ? null : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a customer..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select a customer...</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* PNR */}
        <form.Field name="pnr">
          {(field) => (
            <div className="flex flex-col gap-1">
              <Label htmlFor="pnr">PNR</Label>
              <Input
                id="pnr"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="e.g. ABC123"
              />
            </div>
          )}
        </form.Field>

        {/* Booking source */}
        <form.Field name="booking_source">
          {(field) => (
            <div className="flex flex-col gap-1">
              <Label htmlFor="booking_source">Booking Source</Label>
              <Input
                id="booking_source"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="e.g. Amadeus, Direct"
              />
            </div>
          )}
        </form.Field>

        {/* Status */}
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
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="ticketed">Ticketed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>

        {/* Price + Currency */}
        <div className="grid grid-cols-3 gap-2">
          <form.Field name="total_price">
            {(field) => (
              <div className="col-span-2 flex flex-col gap-1">
                <Label htmlFor="total_price">Total Price</Label>
                <Input
                  id="total_price"
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
          <form.Field name="currency">
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
        </div>

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

        {/* Segments & Passengers sections (edit only) */}
        {isEditing && booking.id && (
          <>
            <Separator />

            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium">Segments</p>
                <p className="text-muted-foreground text-xs">
                  Flight legs in this booking.
                </p>
              </div>

              <SegmentList
                bookingId={booking.id}
                refreshKey={segmentRefreshKey}
              />
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium">Passengers</p>
                <p className="text-muted-foreground text-xs">
                  Passengers on this booking.
                </p>
              </div>

              <BookingPassengerList
                bookingId={booking.id}
                refreshKey={passengerRefreshKey}
                onUnlinked={handlePassengerChanged}
              />

              {selectedCustomerId && (
                <BookingPassengerSelect
                  bookingId={booking.id}
                  customerId={selectedCustomerId}
                  excludeIds={linkedPassengerIds}
                  onLinked={handlePassengerChanged}
                />
              )}
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium">Payments</p>
                <p className="text-muted-foreground text-xs">
                  Payment records for this booking.
                </p>
              </div>

              <PaymentList
                bookingId={booking.id}
                bookingTotalPrice={booking.total_price}
                bookingCurrency={booking.currency}
                refreshKey={paymentRefreshKey}
              />
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium">Commission</p>
                <p className="text-muted-foreground text-xs">
                  Agent commission for this booking.
                </p>
              </div>

              <CommissionSection
                bookingId={booking.id}
                refreshKey={commissionRefreshKey}
              />
            </div>
          </>
        )}

        <SheetFooter className="mt-auto px-0">
          <div className="flex w-full items-center justify-end">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
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
