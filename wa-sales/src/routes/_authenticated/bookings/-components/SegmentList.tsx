import { useEffect, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type BookingSegment = Database['public']['Tables']['booking_segments']['Row']

interface SegmentListProps {
  bookingId: string
  refreshKey: number
}

export function SegmentList({ bookingId, refreshKey }: SegmentListProps) {
  const [segments, setSegments] = useState<BookingSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Add form state
  const [newAirline, setNewAirline] = useState('')
  const [newFlightNumber, setNewFlightNumber] = useState('')
  const [newOrigin, setNewOrigin] = useState('')
  const [newDestination, setNewDestination] = useState('')
  const [newDepartureAt, setNewDepartureAt] = useState('')
  const [newArrivalAt, setNewArrivalAt] = useState('')
  const [newCabinClass, setNewCabinClass] = useState('')

  // Edit form state
  const [editAirline, setEditAirline] = useState('')
  const [editFlightNumber, setEditFlightNumber] = useState('')
  const [editOrigin, setEditOrigin] = useState('')
  const [editDestination, setEditDestination] = useState('')
  const [editDepartureAt, setEditDepartureAt] = useState('')
  const [editArrivalAt, setEditArrivalAt] = useState('')
  const [editCabinClass, setEditCabinClass] = useState('')

  useEffect(() => {
    const ctrl = { cancelled: false }

    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('booking_segments')
        .select('*')
        .eq('booking_id', bookingId)
        .order('segment_order', { ascending: true })

      if (!ctrl.cancelled) {
        setSegments(data ?? [])
        setLoading(false)
      }
    }

    load()
    return () => {
      ctrl.cancelled = true
    }
  }, [bookingId, refreshKey])

  function resetAddForm() {
    setNewAirline('')
    setNewFlightNumber('')
    setNewOrigin('')
    setNewDestination('')
    setNewDepartureAt('')
    setNewArrivalAt('')
    setNewCabinClass('')
    setShowAddForm(false)
  }

  async function handleAdd() {
    if (!newOrigin.trim() || !newDestination.trim()) return

    const nextOrder =
      segments.length > 0
        ? Math.max(...segments.map((s) => s.segment_order)) + 1
        : 1

    const { data, error } = await supabase
      .from('booking_segments')
      .insert({
        booking_id: bookingId,
        segment_order: nextOrder,
        airline: newAirline.trim() || null,
        flight_number: newFlightNumber.trim() || null,
        origin: newOrigin.trim(),
        destination: newDestination.trim(),
        departure_at: newDepartureAt || null,
        arrival_at: newArrivalAt || null,
        cabin_class: newCabinClass.trim() || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding segment:', error)
      return
    }

    setSegments((prev) => [...prev, data])
    resetAddForm()
  }

  function startEdit(segment: BookingSegment) {
    setEditingId(segment.id)
    setEditAirline(segment.airline ?? '')
    setEditFlightNumber(segment.flight_number ?? '')
    setEditOrigin(segment.origin)
    setEditDestination(segment.destination)
    setEditDepartureAt(
      segment.departure_at ? segment.departure_at.substring(0, 16) : '',
    )
    setEditArrivalAt(
      segment.arrival_at ? segment.arrival_at.substring(0, 16) : '',
    )
    setEditCabinClass(segment.cabin_class ?? '')
  }

  async function handleSaveEdit() {
    if (!editingId || !editOrigin.trim() || !editDestination.trim()) return

    const { error } = await supabase
      .from('booking_segments')
      .update({
        airline: editAirline.trim() || null,
        flight_number: editFlightNumber.trim() || null,
        origin: editOrigin.trim(),
        destination: editDestination.trim(),
        departure_at: editDepartureAt || null,
        arrival_at: editArrivalAt || null,
        cabin_class: editCabinClass.trim() || null,
      })
      .eq('id', editingId)

    if (error) {
      console.error('Error updating segment:', error)
      return
    }

    setSegments((prev) =>
      prev.map((s) =>
        s.id === editingId
          ? {
              ...s,
              airline: editAirline.trim() || null,
              flight_number: editFlightNumber.trim() || null,
              origin: editOrigin.trim(),
              destination: editDestination.trim(),
              departure_at: editDepartureAt || null,
              arrival_at: editArrivalAt || null,
              cabin_class: editCabinClass.trim() || null,
            }
          : s,
      ),
    )
    setEditingId(null)
  }

  function formatSegmentDisplay(segment: BookingSegment) {
    const parts: string[] = []
    if (segment.flight_number) {
      parts.push(segment.flight_number)
      parts.push(':')
    }
    parts.push(`${segment.origin} → ${segment.destination}`)
    if (segment.departure_at) {
      try {
        const dt = new Date(segment.departure_at)
        parts.push(
          `— ${dt.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}, ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        )
      } catch {
        // ignore formatting errors
      }
    }
    return parts.join(' ')
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading segments...</p>
  }

  function renderSegmentForm(
    airline: string,
    setAirline: (v: string) => void,
    flightNumber: string,
    setFlightNumber: (v: string) => void,
    origin: string,
    setOrigin: (v: string) => void,
    destination: string,
    setDestination: (v: string) => void,
    departureAt: string,
    setDepartureAt: (v: string) => void,
    arrivalAt: string,
    setArrivalAt: (v: string) => void,
    cabinClass: string,
    setCabinClass: (v: string) => void,
    onSave: () => void,
    onCancel: () => void,
  ) {
    return (
      <div className="flex flex-col gap-2 rounded-md border p-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Airline</Label>
            <Input
              value={airline}
              onChange={(e) => setAirline(e.target.value)}
              placeholder="e.g. LATAM"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Flight #</Label>
            <Input
              value={flightNumber}
              onChange={(e) => setFlightNumber(e.target.value)}
              placeholder="e.g. LA8040"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Origin</Label>
            <Input
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="e.g. GRU"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Destination</Label>
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. MIA"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Departure</Label>
            <Input
              type="datetime-local"
              value={departureAt}
              onChange={(e) => setDepartureAt(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Arrival</Label>
            <Input
              type="datetime-local"
              value={arrivalAt}
              onChange={(e) => setArrivalAt(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Cabin Class</Label>
          <Input
            value={cabinClass}
            onChange={(e) => setCabinClass(e.target.value)}
            placeholder="e.g. Economy"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={onSave}>
            Save
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {segments.length === 0 && !showAddForm && (
        <p className="text-muted-foreground text-sm">No segments added yet.</p>
      )}

      {segments.map((segment) =>
        editingId === segment.id ? (
          renderSegmentForm(
            editAirline,
            setEditAirline,
            editFlightNumber,
            setEditFlightNumber,
            editOrigin,
            setEditOrigin,
            editDestination,
            setEditDestination,
            editDepartureAt,
            setEditDepartureAt,
            editArrivalAt,
            setEditArrivalAt,
            editCabinClass,
            setEditCabinClass,
            handleSaveEdit,
            () => setEditingId(null),
          )
        ) : (
          <div
            key={segment.id}
            className="flex items-start justify-between rounded-md border p-3"
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                {formatSegmentDisplay(segment)}
              </span>
              {segment.airline && (
                <span className="text-muted-foreground text-xs">
                  {segment.airline}
                  {segment.cabin_class ? ` · ${segment.cabin_class}` : ''}
                </span>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => startEdit(segment)}
              >
                <Pencil className="size-4" />
              </Button>
            </div>
          </div>
        ),
      )}

      {showAddForm &&
        renderSegmentForm(
          newAirline,
          setNewAirline,
          newFlightNumber,
          setNewFlightNumber,
          newOrigin,
          setNewOrigin,
          newDestination,
          setNewDestination,
          newDepartureAt,
          setNewDepartureAt,
          newArrivalAt,
          setNewArrivalAt,
          newCabinClass,
          setNewCabinClass,
          handleAdd,
          resetAddForm,
        )}

      {!showAddForm && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(true)}
          className="self-start"
        >
          <Plus className="size-4" />
          Add Segment
        </Button>
      )}
    </div>
  )
}
