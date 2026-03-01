import { useEffect, useState } from 'react'
import { Check, Pencil, Plus, RotateCcw, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Payment = Database['public']['Tables']['payments']['Row']

interface PaymentListProps {
  bookingId: string
  bookingTotalPrice: number | null
  bookingCurrency: string | null
  refreshKey: number
}

const PAYMENT_METHODS = [
  { value: 'pix', label: 'PIX' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
]

const EMPTY_FORM = {
  amount: '',
  currency: 'BRL',
  payment_method: '',
  installments: '1',
  status: 'pending',
  due_date: '',
  reference: '',
  notes: '',
}

export function PaymentList({
  bookingId,
  bookingTotalPrice,
  bookingCurrency,
  refreshKey,
}: PaymentListProps) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [editForm, setEditForm] = useState(EMPTY_FORM)

  useEffect(() => {
    const ctrl = { cancelled: false }

    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('payments')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true })

      if (!ctrl.cancelled) {
        setPayments(data ?? [])
        setLoading(false)
      }
    }

    load()
    return () => {
      ctrl.cancelled = true
    }
  }, [bookingId, refreshKey])

  // --- Progress computation ---
  const totalPaid = payments
    .filter((p) => p.status === 'confirmed')
    .reduce((sum, p) => sum + Number(p.amount), 0)
  const totalPrice = Number(bookingTotalPrice ?? 0)
  const currency = bookingCurrency ?? 'BRL'
  const progressPct =
    totalPrice > 0 ? Math.min((totalPaid / totalPrice) * 100, 100) : 0

  // --- Add ---
  function resetAddForm() {
    setAddForm(EMPTY_FORM)
    setShowAddForm(false)
  }

  async function handleAdd() {
    const amount = parseFloat(addForm.amount)
    if (isNaN(amount) || amount <= 0) return

    const { data, error } = await supabase
      .from('payments')
      .insert({
        booking_id: bookingId,
        amount,
        currency: addForm.currency || 'BRL',
        payment_method: addForm.payment_method || null,
        installments: parseInt(addForm.installments) || 1,
        status: addForm.status,
        due_date: addForm.due_date || null,
        reference: addForm.reference.trim() || null,
        notes: addForm.notes.trim() || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding payment:', error)
      return
    }

    setPayments((prev) => [...prev, data])
    resetAddForm()
  }

  // --- Delete ---
  async function handleDelete(id: string) {
    const { error } = await supabase.from('payments').delete().eq('id', id)

    if (error) {
      console.error('Error deleting payment:', error)
      return
    }

    setPayments((prev) => prev.filter((p) => p.id !== id))
  }

  // --- Edit ---
  function startEdit(payment: Payment) {
    setEditingId(payment.id)
    setEditForm({
      amount: String(payment.amount),
      currency: payment.currency ?? 'BRL',
      payment_method: payment.payment_method ?? '',
      installments: String(payment.installments ?? 1),
      status: payment.status,
      due_date: payment.due_date ?? '',
      reference: payment.reference ?? '',
      notes: payment.notes ?? '',
    })
  }

  async function handleSaveEdit() {
    if (!editingId) return
    const amount = parseFloat(editForm.amount)
    if (isNaN(amount) || amount <= 0) return

    const updates = {
      amount,
      currency: editForm.currency || 'BRL',
      payment_method: editForm.payment_method || null,
      installments: parseInt(editForm.installments) || 1,
      status: editForm.status,
      due_date: editForm.due_date || null,
      reference: editForm.reference.trim() || null,
      notes: editForm.notes.trim() || null,
    }

    const { error } = await supabase
      .from('payments')
      .update(updates)
      .eq('id', editingId)

    if (error) {
      console.error('Error updating payment:', error)
      return
    }

    setPayments((prev) =>
      prev.map((p) => (p.id === editingId ? { ...p, ...updates } : p)),
    )
    setEditingId(null)
  }

  // --- Quick actions ---
  async function markConfirmed(id: string) {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('payments')
      .update({ status: 'confirmed', paid_at: now })
      .eq('id', id)

    if (error) {
      console.error('Error confirming payment:', error)
      return
    }

    setPayments((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: 'confirmed', paid_at: now } : p,
      ),
    )
  }

  async function markRefunded(id: string) {
    const { error } = await supabase
      .from('payments')
      .update({ status: 'refunded' })
      .eq('id', id)

    if (error) {
      console.error('Error refunding payment:', error)
      return
    }

    setPayments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'refunded' } : p)),
    )
  }

  // --- Status badge ---
  function statusBadge(status: string) {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-600 text-white">Confirmed</Badge>
      case 'refunded':
        return <Badge variant="destructive">Refunded</Badge>
      default:
        return <Badge className="bg-yellow-500 text-white">Pending</Badge>
    }
  }

  function methodLabel(method: string | null) {
    if (!method) return null
    return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method
  }

  // --- Form renderer ---
  function renderPaymentForm(
    form: typeof EMPTY_FORM,
    setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>,
    onSave: () => void,
    onCancel: () => void,
  ) {
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

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Method</Label>
            <Select
              value={form.payment_method || '__none__'}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  payment_method: v === '__none__' ? '' : v,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Installments</Label>
            <Input
              type="number"
              min="1"
              value={form.installments}
              onChange={(e) =>
                setForm((f) => ({ ...f, installments: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Due Date</Label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, due_date: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">Reference</Label>
          <Input
            value={form.reference}
            onChange={(e) =>
              setForm((f) => ({ ...f, reference: e.target.value }))
            }
            placeholder="Transaction ID, receipt #..."
          />
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

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading payments...</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Progress indicator */}
      {totalPrice > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">
            {currency}{' '}
            {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /{' '}
            {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}{' '}
            paid
          </p>
          <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-green-600 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {payments.length === 0 && !showAddForm && (
        <p className="text-muted-foreground text-sm">
          No payments recorded yet.
        </p>
      )}

      {payments.map((payment) =>
        editingId === payment.id ? (
          <div key={payment.id}>
            {renderPaymentForm(editForm, setEditForm, handleSaveEdit, () =>
              setEditingId(null),
            )}
          </div>
        ) : (
          <div
            key={payment.id}
            className="flex items-start justify-between rounded-md border p-3"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {payment.currency ?? 'BRL'}{' '}
                  {Number(payment.amount).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
                {statusBadge(payment.status)}
              </div>
              <div className="text-muted-foreground flex flex-wrap gap-2 text-xs">
                {methodLabel(payment.payment_method) && (
                  <span>{methodLabel(payment.payment_method)}</span>
                )}
                {payment.installments && payment.installments > 1 && (
                  <span>{payment.installments}x</span>
                )}
                {payment.due_date && <span>Due: {payment.due_date}</span>}
                {payment.reference && <span>Ref: {payment.reference}</span>}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              {payment.status === 'pending' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Mark Confirmed"
                  onClick={() => markConfirmed(payment.id)}
                >
                  <Check className="size-4" />
                </Button>
              )}
              {payment.status === 'confirmed' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Mark Refunded"
                  onClick={() => markRefunded(payment.id)}
                >
                  <RotateCcw className="size-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => startEdit(payment)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(payment.id)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        ),
      )}

      {showAddForm &&
        renderPaymentForm(addForm, setAddForm, handleAdd, resetAddForm)}

      {!showAddForm && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(true)}
          className="self-start"
        >
          <Plus className="size-4" />
          Add Payment
        </Button>
      )}
    </div>
  )
}
