import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Passenger = Database['public']['Tables']['passengers']['Row']
type FlightRequestPassenger =
  Database['public']['Tables']['flight_request_passengers']['Row']

interface RequestPassengerListProps {
  flightRequestId: string
  refreshKey: number
  onUnlinked: () => void
}

export function RequestPassengerList({
  flightRequestId,
  refreshKey,
  onUnlinked,
}: RequestPassengerListProps) {
  const [passengers, setPassengers] = useState<Passenger[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctrl: { cancelled: boolean } = { cancelled: false }

    async function load() {
      setLoading(true)

      const { data: junctions } = await supabase
        .from('flight_request_passengers')
        .select('*')
        .eq('flight_request_id', flightRequestId)

      if (ctrl.cancelled) return

      if (!junctions || junctions.length === 0) {
        setPassengers([])
        setLoading(false)
        return
      }

      const passengerIds = (junctions as FlightRequestPassenger[]).map(
        (j) => j.passenger_id,
      )

      if (passengerIds.length === 0) {
        setPassengers([])
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('passengers')
        .select('*')
        .in('id', passengerIds)

      setPassengers(data ?? [])
      setLoading(false)
    }

    load()
    return () => {
      ctrl.cancelled = true
    }
  }, [flightRequestId, refreshKey])

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
          <span className="text-sm font-medium">{passenger.full_name}</span>
        </div>
      ))}
    </div>
  )
}
