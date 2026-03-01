import { useEffect, useState } from 'react'
import { Check, Pencil, Plus, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type QuoteOption = Database['public']['Tables']['quote_options']['Row']

interface QuoteOptionListProps {
  flightRequestId: string
  refreshKey: number
  onStatusChange?: () => void
  chatId?: string | null
  origin?: string | null
  destination?: string | null
}

export function QuoteOptionList({
  flightRequestId,
  refreshKey,
  onStatusChange,
  chatId,
  origin,
  destination,
}: QuoteOptionListProps) {
  const [options, setOptions] = useState<QuoteOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Add form state
  const [newDescription, setNewDescription] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newCurrency, setNewCurrency] = useState('BRL')
  const [newDepartureDate, setNewDepartureDate] = useState('')
  const [newReturnDate, setNewReturnDate] = useState('')

  // Edit form state
  const [editDescription, setEditDescription] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editCurrency, setEditCurrency] = useState('BRL')
  const [editDepartureDate, setEditDepartureDate] = useState('')
  const [editReturnDate, setEditReturnDate] = useState('')

  // Send state
  const [sendingId, setSendingId] = useState<string | null>(null)

  useEffect(() => {
    const ctrl = { cancelled: false }

    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('quote_options')
        .select('*')
        .eq('flight_request_id', flightRequestId)
        .order('created_at', { ascending: true })

      if (!ctrl.cancelled) {
        setOptions(data ?? [])
        setLoading(false)
      }
    }

    load()
    return () => {
      ctrl.cancelled = true
    }
  }, [flightRequestId, refreshKey])

  async function handleAdd() {
    if (!newDescription.trim()) return

    const { data, error } = await supabase
      .from('quote_options')
      .insert({
        flight_request_id: flightRequestId,
        description: newDescription.trim(),
        price: newPrice ? parseFloat(newPrice) : null,
        currency: newCurrency || 'BRL',
        departure_date: newDepartureDate || null,
        return_date: newReturnDate || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding quote option:', error)
      return
    }

    setOptions((prev) => [...prev, data])
    setNewDescription('')
    setNewPrice('')
    setNewCurrency('BRL')
    setNewDepartureDate('')
    setNewReturnDate('')
    setShowAddForm(false)
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('quote_options').delete().eq('id', id)

    if (error) {
      console.error('Error deleting quote option:', error)
      return
    }

    setOptions((prev) => prev.filter((o) => o.id !== id))
  }

  async function handleToggleSelected(id: string) {
    // Unset all others, set this one
    const { error: unsetError } = await supabase
      .from('quote_options')
      .update({ is_selected: false })
      .eq('flight_request_id', flightRequestId)

    if (unsetError) {
      console.error('Error unsetting selected:', unsetError)
      return
    }

    const option = options.find((o) => o.id === id)
    const newSelected = !option?.is_selected

    if (newSelected) {
      const { error } = await supabase
        .from('quote_options')
        .update({ is_selected: true })
        .eq('id', id)

      if (error) {
        console.error('Error setting selected:', error)
        return
      }

      // Auto-update flight request status to "accepted"
      await supabase
        .from('flight_requests')
        .update({ status: 'accepted' })
        .eq('id', flightRequestId)
      onStatusChange?.()
    }

    setOptions((prev) =>
      prev.map((o) => ({
        ...o,
        is_selected: o.id === id ? newSelected : false,
      })),
    )
  }

  function startEdit(option: QuoteOption) {
    setEditingId(option.id)
    setEditDescription(option.description)
    setEditPrice(option.price?.toString() ?? '')
    setEditCurrency(option.currency ?? 'BRL')
    setEditDepartureDate(option.departure_date ?? '')
    setEditReturnDate(option.return_date ?? '')
  }

  async function handleSaveEdit() {
    if (!editingId || !editDescription.trim()) return

    const { error } = await supabase
      .from('quote_options')
      .update({
        description: editDescription.trim(),
        price: editPrice ? parseFloat(editPrice) : null,
        currency: editCurrency || 'BRL',
        departure_date: editDepartureDate || null,
        return_date: editReturnDate || null,
      })
      .eq('id', editingId)

    if (error) {
      console.error('Error updating quote option:', error)
      return
    }

    setOptions((prev) =>
      prev.map((o) =>
        o.id === editingId
          ? {
              ...o,
              description: editDescription.trim(),
              price: editPrice ? parseFloat(editPrice) : null,
              currency: editCurrency || 'BRL',
              departure_date: editDepartureDate || null,
              return_date: editReturnDate || null,
            }
          : o,
      ),
    )
    setEditingId(null)
  }

  async function handleSendQuote(option: QuoteOption) {
    if (!chatId) return
    setSendingId(option.id)
    try {
      const lines: string[] = []
      if (option.description) lines.push(`*Cotação: ${option.description}*`)
      if (origin || destination)
        lines.push(`${origin ?? '???'} → ${destination ?? '???'}`)
      if (option.price != null)
        lines.push(
          `Preço: ${option.currency ?? 'BRL'} ${Number(option.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        )
      if (option.departure_date)
        lines.push(
          `Ida: ${new Date(option.departure_date + 'T00:00:00').toLocaleDateString('pt-BR')}`,
        )
      if (option.return_date)
        lines.push(
          `Volta: ${new Date(option.return_date + 'T00:00:00').toLocaleDateString('pt-BR')}`,
        )

      const content = lines.join('\n')

      const { error } = await supabase
        .from('outgoing_messages')
        .insert({ chat_id: chatId, content })

      if (error) {
        console.error('Error sending quote:', error)
      }
    } finally {
      setSendingId(null)
    }
  }

  if (loading) {
    return (
      <p className="text-muted-foreground text-sm">Loading quote options...</p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {options.length === 0 && !showAddForm && (
        <p className="text-muted-foreground text-sm">No quotes added yet.</p>
      )}

      {options.map((option) =>
        editingId === option.id ? (
          <div
            key={option.id}
            className="flex flex-col gap-2 rounded-md border p-3"
          >
            <Input
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description"
            />
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                placeholder="Price"
                className="flex-1"
              />
              <Input
                value={editCurrency}
                onChange={(e) => setEditCurrency(e.target.value)}
                placeholder="Currency"
                className="w-20"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex flex-1 flex-col gap-1">
                <Label className="text-xs">Departure</Label>
                <Input
                  type="date"
                  value={editDepartureDate}
                  onChange={(e) => setEditDepartureDate(e.target.value)}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <Label className="text-xs">Return</Label>
                <Input
                  type="date"
                  value={editReturnDate}
                  onChange={(e) => setEditReturnDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingId(null)}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={handleSaveEdit}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div
            key={option.id}
            className="flex items-start justify-between rounded-md border p-3"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {option.description}
                </span>
                {option.is_selected && (
                  <Badge variant="default">Selected</Badge>
                )}
              </div>
              {option.price != null && (
                <span className="text-muted-foreground text-xs">
                  {option.currency ?? 'BRL'}{' '}
                  {Number(option.price).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              )}
              {(option.departure_date || option.return_date) && (
                <span className="text-muted-foreground text-xs">
                  {option.departure_date &&
                    new Date(
                      option.departure_date + 'T00:00:00',
                    ).toLocaleDateString('pt-BR')}
                  {option.departure_date && option.return_date && ' → '}
                  {option.return_date &&
                    new Date(
                      option.return_date + 'T00:00:00',
                    ).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleToggleSelected(option.id)}
                title={option.is_selected ? 'Unselect' : 'Mark as selected'}
              >
                <Check
                  className={`size-4 ${option.is_selected ? 'text-green-600' : ''}`}
                />
              </Button>
              {chatId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleSendQuote(option)}
                  disabled={sendingId === option.id}
                  title="Send quote to WhatsApp"
                >
                  <Send className="size-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => startEdit(option)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(option.id)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        ),
      )}

      {showAddForm && (
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <Input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Quote description"
          />
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.01"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="Price"
              className="flex-1"
            />
            <Input
              value={newCurrency}
              onChange={(e) => setNewCurrency(e.target.value)}
              placeholder="Currency"
              className="w-20"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <Label className="text-xs">Departure</Label>
              <Input
                type="date"
                value={newDepartureDate}
                onChange={(e) => setNewDepartureDate(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <Label className="text-xs">Return</Label>
              <Input
                type="date"
                value={newReturnDate}
                onChange={(e) => setNewReturnDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddForm(false)
                setNewDescription('')
                setNewPrice('')
                setNewCurrency('BRL')
                setNewDepartureDate('')
                setNewReturnDate('')
              }}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleAdd}>
              Save
            </Button>
          </div>
        </div>
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
          Add Quote
        </Button>
      )}
    </div>
  )
}
