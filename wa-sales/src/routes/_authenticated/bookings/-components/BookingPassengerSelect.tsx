import { useEffect, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Passenger = Database['public']['Tables']['passengers']['Row']

interface BookingPassengerSelectProps {
  bookingId: string
  customerId: string
  excludeIds: string[]
  onLinked: () => void
}

export function BookingPassengerSelect({
  bookingId,
  customerId,
  excludeIds,
  onLinked,
}: BookingPassengerSelectProps) {
  const [passengers, setPassengers] = useState<Passenger[]>([])

  useEffect(() => {
    async function load() {
      const { data: junctions } = await supabase
        .from('customer_passengers')
        .select('passenger_id')
        .eq('customer_id', customerId)

      if (!junctions || junctions.length === 0) {
        setPassengers([])
        return
      }

      const ids = junctions.map((j) => j.passenger_id)

      if (ids.length === 0) {
        setPassengers([])
        return
      }

      const { data } = await supabase
        .from('passengers')
        .select('*')
        .in('id', ids)
        .order('full_name', { ascending: true })

      if (data) setPassengers(data)
    }

    load()
  }, [customerId])

  const available = passengers.filter((p) => p.id && !excludeIds.includes(p.id))

  async function handleValueChange(passengerId: string) {
    if (passengerId === '__none__') return

    const { error } = await supabase.from('booking_passengers').insert({
      booking_id: bookingId,
      passenger_id: passengerId,
    })

    if (error) {
      console.error('Error linking passenger:', error)
      return
    }

    onLinked()
  }

  if (available.length === 0) return null

  return (
    <Select value="__none__" onValueChange={handleValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Link passenger to booking..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">Link passenger to booking...</SelectItem>
        {available.map((passenger) => (
          <SelectItem key={passenger.id} value={passenger.id}>
            {passenger.full_name}
            {passenger.document_number ? ` (${passenger.document_number})` : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
