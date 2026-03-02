import { useState } from 'react'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { RequestSheet } from './RequestSheet'
import { BookingSheet } from '@/routes/_authenticated/bookings/-components/BookingSheet'

type FlightRequest = Database['public']['Tables']['flight_requests']['Row']
type Booking = Database['public']['Tables']['bookings']['Row']

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
  const [viewingBooking, setViewingBooking] = useState<Booking | null>(null)

  function handleOpenChange(isOpen: boolean) {
    onOpenChange(isOpen)
    if (!isOpen) onChanged()
  }

  function handleSaved() {
    onOpenChange(false)
    onChanged()
  }

  function handleCreateBooking(flightRequestId: string, forCustomerId: string) {
    onOpenChange(false)
    setBookingFlightRequestId(flightRequestId)
    setBookingCustomerId(forCustomerId)
    setBookingSheetOpen(true)
  }

  async function handleViewBooking(bookingId: string, forCustomerId: string) {
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (data) {
      onOpenChange(false)
      setViewingBooking(data)
      setBookingCustomerId(forCustomerId)
      setBookingFlightRequestId(null)
      setBookingSheetOpen(true)
    }
  }

  function handleBookingSaved() {
    setBookingSheetOpen(false)
    setBookingFlightRequestId(null)
    setBookingCustomerId(null)
    setViewingBooking(null)
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
          onCreateBooking={handleCreateBooking}
          onViewBooking={handleViewBooking}
        />
      )}
      <BookingSheet
        open={bookingSheetOpen}
        onOpenChange={setBookingSheetOpen}
        customerId={bookingCustomerId}
        booking={viewingBooking}
        flightRequestId={bookingFlightRequestId}
        onSaved={handleBookingSaved}
      />
    </>
  )
}
