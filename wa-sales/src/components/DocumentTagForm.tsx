import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Message = Database['public']['Views']['messages']['Row']

const DOCUMENT_TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'id_card', label: 'ID Card' },
  { value: 'cpf', label: 'CPF' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'voucher', label: 'Voucher' },
  { value: 'itinerary', label: 'Itinerary' },
  { value: 'other', label: 'Other' },
]

interface DocumentTagFormProps {
  message: Message | null
  customerId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DocumentTagForm({
  message,
  customerId,
  open,
  onOpenChange,
}: DocumentTagFormProps) {
  const [documentType, setDocumentType] = useState('')
  const [label, setLabel] = useState('')
  const [passengerId, setPassengerId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [passengers, setPassengers] = useState<
    { id: string; full_name: string }[]
  >([])

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setDocumentType('')
      setLabel('')
      setPassengerId(null)
    }
  }, [open])

  // Load passengers for customer
  useEffect(() => {
    if (!open) {
      setPassengers([])
      return
    }
    supabase
      .from('customer_passengers')
      .select('passenger_id, passengers(id, full_name)')
      .eq('customer_id', customerId)
      .then(({ data }) => {
        const list = (data ?? [])
          .map((row) => {
            const p = row.passengers as unknown as {
              id: string
              full_name: string
            } | null
            return p ? { id: p.id, full_name: p.full_name } : null
          })
          .filter((p): p is { id: string; full_name: string } => p !== null)
        setPassengers(list)
      })
  }, [open, customerId])

  async function handleSave() {
    if (!message?.media_path || !documentType) return

    setSaving(true)
    const { error } = await supabase.from('documents').insert({
      message_id: message.message_id,
      chat_id: message.chat_id,
      storage_path: message.media_path,
      document_type: documentType,
      label: label.trim() || null,
      customer_id: customerId || null,
      passenger_id: passengerId,
    })

    setSaving(false)

    if (error) {
      console.error('Error tagging document:', error)
      return
    }

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tag Document</DialogTitle>
          <DialogDescription>
            Categorize this media file and optionally link it to a passenger.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Document type */}
          <div className="flex flex-col gap-1">
            <Label>Document type *</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Label */}
          <div className="flex flex-col gap-1">
            <Label>Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Optional description..."
            />
          </div>

          {/* Passenger */}
          {passengers.length > 0 && (
            <div className="flex flex-col gap-1">
              <Label>Passenger</Label>
              <Select
                value={passengerId ?? '__none__'}
                onValueChange={(v) =>
                  setPassengerId(v === '__none__' ? null : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select passenger..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {passengers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!documentType || saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
