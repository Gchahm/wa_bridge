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

interface PassengerSelectProps {
  customerId: string
  excludeIds: string[]
  onLinked: () => void
}

export function PassengerSelect({
  customerId,
  excludeIds,
  onLinked,
}: PassengerSelectProps) {
  const [passengers, setPassengers] = useState<Passenger[]>([])

  useEffect(() => {
    supabase
      .from('passengers')
      .select('*')
      .order('full_name', { ascending: true })
      .then(({ data }) => {
        if (data) setPassengers(data)
      })
  }, [])

  const available = passengers.filter((p) => p.id && !excludeIds.includes(p.id))

  async function handleValueChange(passengerId: string) {
    if (passengerId === '__none__') return

    const { error } = await supabase.from('customer_passengers').insert({
      customer_id: customerId,
      passenger_id: passengerId,
      label: null,
    })

    if (error) {
      console.error('Error linking passenger:', error)
      return
    }

    onLinked()
  }

  return (
    <Select value="__none__" onValueChange={handleValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Link existing passenger..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">Link existing passenger...</SelectItem>
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
