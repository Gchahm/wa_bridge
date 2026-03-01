import { useEffect, useState } from 'react'
import { X, UserPlus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Passenger = Database['public']['Tables']['passengers']['Row']
type CustomerPassenger =
  Database['public']['Tables']['customer_passengers']['Row']

interface PassengerRow {
  passenger: Passenger
  label: string | null
}

interface PassengerListProps {
  customerId: string
  refreshKey: number
  onEdit: (passenger: Passenger, label: string | null) => void
  onAdd: () => void
  onAddSelf: () => void
  showAddSelf: boolean
}

export function PassengerList({
  customerId,
  refreshKey,
  onEdit,
  onAdd,
  onAddSelf,
  showAddSelf,
}: PassengerListProps) {
  const [rows, setRows] = useState<PassengerRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctrl: { cancelled: boolean } = { cancelled: false }

    async function load() {
      setLoading(true)

      const { data: junctions } = await supabase
        .from('customer_passengers')
        .select('*')
        .eq('customer_id', customerId)

      if (ctrl.cancelled) return

      if (!junctions || junctions.length === 0) {
        setRows([])
        setLoading(false)
        return
      }

      const passengerIds = junctions.map(
        (j: CustomerPassenger) => j.passenger_id,
      )

      const { data: passengers } = await supabase
        .from('passengers')
        .select('*')
        .in('id', passengerIds)

      const passengerMap = new Map<string, Passenger>(
        (passengers ?? []).map((p: Passenger) => [p.id, p]),
      )

      const built: PassengerRow[] = junctions
        .filter(
          (j: CustomerPassenger) =>
            j.passenger_id && passengerMap.has(j.passenger_id),
        )
        .map((j: CustomerPassenger) => ({
          passenger: passengerMap.get(j.passenger_id)!,
          label: j.label,
        }))

      setRows(built)
      setLoading(false)
    }

    load()

    return () => {
      ctrl.cancelled = true
    }
  }, [customerId, refreshKey])

  async function handleUnlink(passengerId: string) {
    await supabase
      .from('customer_passengers')
      .delete()
      .eq('customer_id', customerId)
      .eq('passenger_id', passengerId)

    setRows((prev) => prev.filter((r) => r.passenger.id !== passengerId))
  }

  function formatDocument(passenger: Passenger) {
    if (!passenger.document_type && !passenger.document_number) return null
    const parts: string[] = []
    if (passenger.document_type)
      parts.push(passenger.document_type.toUpperCase())
    if (passenger.document_number) parts.push(passenger.document_number)
    return parts.join(': ')
  }

  function formatDob(dob: string | null) {
    if (!dob) return null
    try {
      return new Date(dob).toLocaleDateString('pt-BR')
    } catch {
      return dob
    }
  }

  if (loading) {
    return (
      <p className="text-muted-foreground text-sm">Loading passengers...</p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No passengers linked yet.
        </p>
      )}

      {rows.map(({ passenger, label }) => (
        <button
          type="button"
          key={passenger.id}
          className="flex w-full cursor-pointer items-start justify-between rounded-md border p-3 text-left hover:bg-muted/50 transition-colors"
          onClick={() => onEdit(passenger, label)}
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{passenger.full_name}</span>
              {label && <Badge variant="secondary">{label}</Badge>}
            </div>
            {formatDocument(passenger) && (
              <span className="text-muted-foreground text-xs">
                {formatDocument(passenger)}
              </span>
            )}
            {passenger.date_of_birth && (
              <span className="text-muted-foreground text-xs">
                DOB: {formatDob(passenger.date_of_birth)}
              </span>
            )}
          </div>

          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                handleUnlink(passenger.id)
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
        </button>
      ))}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="size-4" />
          Add Passenger
        </Button>
        {showAddSelf && (
          <Button type="button" variant="outline" size="sm" onClick={onAddSelf}>
            <UserPlus className="size-4" />
            Add self as passenger
          </Button>
        )}
      </div>
    </div>
  )
}
