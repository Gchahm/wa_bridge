import { useEffect, useState } from 'react'
import { Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Passenger = Database['public']['Views']['passengers']['Row']
type BookingPassenger = Database['public']['Views']['booking_passengers']['Row']

interface BookingPassengerListProps {
  bookingId: string
  refreshKey: number
  onUnlinked: () => void
}

interface PassengerWithTicket extends Passenger {
  ticket_number: string | null
}

export function BookingPassengerList({
  bookingId,
  refreshKey,
  onUnlinked,
}: BookingPassengerListProps) {
  const [passengers, setPassengers] = useState<PassengerWithTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null)
  const [editTicketValue, setEditTicketValue] = useState('')

  useEffect(() => {
    const ctrl: { cancelled: boolean } = { cancelled: false }

    async function load() {
      setLoading(true)

      const { data: junctions } = await supabase
        .from('booking_passengers')
        .select('*')
        .eq('booking_id', bookingId)

      if (ctrl.cancelled) return

      if (!junctions || junctions.length === 0) {
        setPassengers([])
        setLoading(false)
        return
      }

      const typedJunctions = junctions as BookingPassenger[]
      const passengerIds = typedJunctions
        .map((j) => j.passenger_id)
        .filter((id): id is string => id !== null)

      if (passengerIds.length === 0) {
        setPassengers([])
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('passengers')
        .select('*')
        .in('id', passengerIds)

      const ticketMap = new Map(
        typedJunctions.map((j) => [j.passenger_id, j.ticket_number ?? null]),
      )

      setPassengers(
        (data ?? []).map((p) => ({
          ...p,
          ticket_number: ticketMap.get(p.id) ?? null,
        })),
      )
      setLoading(false)
    }

    load()
    return () => {
      ctrl.cancelled = true
    }
  }, [bookingId, refreshKey])

  async function handleUnlink(passengerId: string) {
    const { error } = await supabase
      .from('booking_passengers')
      .delete()
      .eq('booking_id', bookingId)
      .eq('passenger_id', passengerId)

    if (error) {
      console.error('Error unlinking passenger:', error)
      return
    }

    setPassengers((prev) => prev.filter((p) => p.id !== passengerId))
    onUnlinked()
  }

  function startEditTicket(passenger: PassengerWithTicket) {
    setEditingTicketId(passenger.id)
    setEditTicketValue(passenger.ticket_number ?? '')
  }

  async function handleSaveTicket(passengerId: string) {
    const { error } = await supabase
      .from('booking_passengers')
      .update({ ticket_number: editTicketValue.trim() || null })
      .eq('booking_id', bookingId)
      .eq('passenger_id', passengerId)

    if (error) {
      console.error('Error updating ticket number:', error)
      return
    }

    setPassengers((prev) =>
      prev.map((p) =>
        p.id === passengerId
          ? { ...p, ticket_number: editTicketValue.trim() || null }
          : p,
      ),
    )
    setEditingTicketId(null)
  }

  if (loading) {
    return (
      <p className="text-muted-foreground text-sm">Loading passengers...</p>
    )
  }

  if (passengers.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No passengers linked yet.</p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {passengers.map((passenger) => (
        <div
          key={passenger.id}
          className="flex items-center justify-between rounded-md border p-2"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{passenger.full_name}</span>
            {editingTicketId === passenger.id ? (
              <div className="flex items-center gap-1">
                <Input
                  value={editTicketValue}
                  onChange={(e) => setEditTicketValue(e.target.value)}
                  placeholder="Ticket number"
                  className="h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSaveTicket(passenger.id as string)
                    }
                    if (e.key === 'Escape') setEditingTicketId(null)
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleSaveTicket(passenger.id as string)}
                >
                  Save
                </Button>
              </div>
            ) : (
              <span className="text-muted-foreground text-xs">
                {passenger.ticket_number
                  ? `Ticket: ${passenger.ticket_number}`
                  : 'No ticket number'}
              </span>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => startEditTicket(passenger)}
              title="Edit ticket number"
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleUnlink(passenger.id as string)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
