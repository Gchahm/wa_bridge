import { useEffect, useState } from 'react'
import { Check, Pencil, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type QuoteOption = Database['public']['Views']['quote_options']['Row']

interface QuoteOptionListProps {
  flightRequestId: string
  refreshKey: number
}

export function QuoteOptionList({
  flightRequestId,
  refreshKey,
}: QuoteOptionListProps) {
  const [options, setOptions] = useState<QuoteOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Add form state
  const [newDescription, setNewDescription] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newCurrency, setNewCurrency] = useState('BRL')

  // Edit form state
  const [editDescription, setEditDescription] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editCurrency, setEditCurrency] = useState('BRL')

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
    setEditDescription(option.description ?? '')
    setEditPrice(option.price?.toString() ?? '')
    setEditCurrency(option.currency ?? 'BRL')
  }

  async function handleSaveEdit() {
    if (!editingId || !editDescription.trim()) return

    const { error } = await supabase
      .from('quote_options')
      .update({
        description: editDescription.trim(),
        price: editPrice ? parseFloat(editPrice) : null,
        currency: editCurrency || 'BRL',
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
            }
          : o,
      ),
    )
    setEditingId(null)
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
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleToggleSelected(option.id!)}
                title={option.is_selected ? 'Unselect' : 'Mark as selected'}
              >
                <Check
                  className={`size-4 ${option.is_selected ? 'text-green-600' : ''}`}
                />
              </Button>
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
                onClick={() => handleDelete(option.id!)}
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
