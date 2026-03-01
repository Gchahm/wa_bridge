import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { RequestSheet } from './RequestSheet'
import { BookingSheet } from '@/routes/_authenticated/bookings/-components/BookingSheet'

type FlightRequest = Database['public']['Tables']['flight_requests']['Row']

interface RequestBookingSheetsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string | null
  chatId?: string | null
  request: FlightRequest | null
  onChanged: () => void
}

export function RequestBookingSheets({
  open,
  onOpenChange,
  customerId,
  chatId,
  request,
  onChanged,
}: RequestBookingSheetsProps) {
  const [bookingSheetOpen, setBookingSheetOpen] = useState(false)
  const [bookingFlightRequestId, setBookingFlightRequestId] = useState<
    string | null
  >(null)
  const [bookingCustomerId, setBookingCustomerId] = useState<string | null>(
    null,
  )

  function handleOpenChange(isOpen: boolean) {
    onOpenChange(isOpen)
    if (!isOpen) onChanged()
  }

  function handleSaved() {
    onOpenChange(false)
    onChanged()
  }

  async function handleDelete(id: string) {
    const { error } = await supabase
      .from('flight_requests')
      .delete()
      .eq('id', id)
    if (error) {
      console.error('Error deleting request:', error)
      return
    }
    onOpenChange(false)
    onChanged()
  }

  function handleCreateBooking(flightRequestId: string, forCustomerId: string) {
    onOpenChange(false)
    setBookingFlightRequestId(flightRequestId)
    setBookingCustomerId(forCustomerId)
    setBookingSheetOpen(true)
  }

  function handleBookingSaved() {
    setBookingSheetOpen(false)
    setBookingFlightRequestId(null)
    setBookingCustomerId(null)
    onChanged()
  }

  return (
    <>
      {customerId && (
        <RequestSheet
          open={open}
          onOpenChange={handleOpenChange}
          customerId={customerId}
          chatId={chatId}
          request={request}
          onSaved={handleSaved}
          onDelete={handleDelete}
          onCreateBooking={handleCreateBooking}
        />
      )}
      <BookingSheet
        open={bookingSheetOpen}
        onOpenChange={setBookingSheetOpen}
        customerId={bookingCustomerId}
        booking={null}
        flightRequestId={bookingFlightRequestId}
        onSaved={handleBookingSaved}
      />
    </>
  )
}
