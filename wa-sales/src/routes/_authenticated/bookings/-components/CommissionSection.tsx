import { useEffect, useState } from 'react'
import { Check, Pencil, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Commission = Database['public']['Tables']['commissions']['Row']

interface CommissionSectionProps {
  bookingId: string
  refreshKey: number
}

const EMPTY_FORM = {
  amount: '',
  currency: 'BRL',
  status: 'pending',
  notes: '',
}

export function CommissionSection({
  bookingId,
  refreshKey,
}: CommissionSectionProps) {
  const [commission, setCommission] = useState<Commission | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    const ctrl = { cancelled: false }

    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('commissions')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!ctrl.cancelled) {
        setCommission(data)
        setLoading(false)
      }
    }

    load()
    return () => {
      ctrl.cancelled = true
    }
  }, [bookingId, refreshKey])

  function startEdit(c: Commission) {
    setForm({
      amount: String(c.amount),
      currency: c.currency ?? 'BRL',
      status: c.status,
      notes: c.notes ?? '',
    })
    setIsEditing(true)
  }

  function startCreate() {
    setForm(EMPTY_FORM)
    setIsEditing(true)
  }

  function cancelEdit() {
    setIsEditing(false)
  }

  async function handleSave() {
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) return

    if (commission) {
      // Update existing
      const updates = {
        amount,
        currency: form.currency || 'BRL',
        status: form.status,
        notes: form.notes.trim() || null,
      }

      const { error } = await supabase
        .from('commissions')
        .update(updates)
        .eq('id', commission.id)

      if (error) {
        console.error('Error updating commission:', error)
        return
      }

      setCommission({ ...commission, ...updates })
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('commissions')
        .insert({
          booking_id: bookingId,
          amount,
          currency: form.currency || 'BRL',
          status: form.status,
          notes: form.notes.trim() || null,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating commission:', error)
        return
      }

      setCommission(data)
    }

    setIsEditing(false)
  }

  async function markReceived() {
    if (!commission) return
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('commissions')
      .update({ status: 'received', received_at: now })
      .eq('id', commission.id)

    if (error) {
      console.error('Error marking commission received:', error)
      return
    }

    setCommission({ ...commission, status: 'received', received_at: now })
  }

  function statusBadge(status: string) {
    if (status === 'received') {
      return <Badge className="bg-green-600 text-white">Received</Badge>
    }
    return <Badge className="bg-yellow-500 text-white">Pending</Badge>
  }

  if (loading) {
    return (
      <p className="text-muted-foreground text-sm">Loading commission...</p>
    )
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2 rounded-md border p-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 flex flex-col gap-1">
            <Label className="text-xs">Amount</Label>
            <Input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: e.target.value }))
              }
              placeholder="0.00"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Currency</Label>
            <Input
              value={form.currency}
              onChange={(e) =>
                setForm((f) => ({ ...f, currency: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">Notes</Label>
          <Input
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Optional notes..."
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={cancelEdit}
          >
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    )
  }

  if (!commission) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={startCreate}
        className="self-start"
      >
        <Plus className="size-4" />
        Add Commission
      </Button>
    )
  }

  return (
    <div className="flex items-start justify-between rounded-md border p-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {commission.currency ?? 'BRL'}{' '}
            {Number(commission.amount).toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
            })}
          </span>
          {statusBadge(commission.status)}
        </div>
        <div className="text-muted-foreground flex flex-wrap gap-2 text-xs">
          {commission.received_at && (
            <span>
              Received:{' '}
              {new Date(commission.received_at).toLocaleDateString('pt-BR')}
            </span>
          )}
          {commission.notes && <span>{commission.notes}</span>}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {commission.status === 'pending' && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Mark Received"
            onClick={markReceived}
          >
            <Check className="size-4" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => startEdit(commission)}
        >
          <Pencil className="size-4" />
        </Button>
      </div>
    </div>
  )
}
