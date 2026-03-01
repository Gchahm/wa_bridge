import { useEffect, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { ArrowLeft, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { DocumentList } from '@/components/DocumentList'

type Passenger = Database['public']['Tables']['passengers']['Row']

const passengerSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  label: z.string().optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  nationality: z.string().optional(),
  document_type: z.string().optional(),
  document_number: z.string().optional(),
  frequent_flyer_airline: z.string().optional(),
  frequent_flyer_number: z.string().optional(),
  notes: z.string().optional(),
})

interface PassengerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  passenger: Passenger | null
  junctionLabel: string | null
  prefill: { full_name?: string; label?: string } | null
  onSaved: () => void
}

export function PassengerSheet({
  open,
  onOpenChange,
  customerId,
  passenger,
  junctionLabel,
  prefill,
  onSaved,
}: PassengerSheetProps) {
  const isEditing = !!passenger
  const [viewMode, setViewMode] = useState<'summary' | 'form'>(
    passenger ? 'summary' : 'form',
  )

  const form = useForm({
    defaultValues: {
      full_name: passenger?.full_name ?? prefill?.full_name ?? '',
      label: junctionLabel ?? prefill?.label ?? '',
      date_of_birth: passenger?.date_of_birth ?? '',
      gender: passenger?.gender ?? '',
      nationality: passenger?.nationality ?? '',
      document_type: passenger?.document_type ?? '',
      document_number: passenger?.document_number ?? '',
      frequent_flyer_airline: passenger?.frequent_flyer_airline ?? '',
      frequent_flyer_number: passenger?.frequent_flyer_number ?? '',
      notes: passenger?.notes ?? '',
    },
    onSubmit: async ({ value }) => {
      const parsed = passengerSchema.safeParse(value)
      if (!parsed.success) return

      const passengerPayload = {
        full_name: parsed.data.full_name,
        date_of_birth: parsed.data.date_of_birth || null,
        gender: parsed.data.gender || null,
        nationality: parsed.data.nationality || null,
        document_type: parsed.data.document_type || null,
        document_number: parsed.data.document_number || null,
        frequent_flyer_airline: parsed.data.frequent_flyer_airline || null,
        frequent_flyer_number: parsed.data.frequent_flyer_number || null,
        notes: parsed.data.notes || null,
      }

      const labelValue = parsed.data.label || null

      if (isEditing && passenger.id) {
        const { error: updateError } = await supabase
          .from('passengers')
          .update(passengerPayload)
          .eq('id', passenger.id)

        if (updateError) {
          console.error('Error updating passenger:', updateError)
          return
        }

        const { error: upsertError } = await supabase
          .from('customer_passengers')
          .upsert(
            {
              customer_id: customerId,
              passenger_id: passenger.id,
              label: labelValue,
            },
            { onConflict: 'customer_id,passenger_id' },
          )

        if (upsertError) {
          console.error('Error upserting junction:', upsertError)
          return
        }
      } else {
        const { data: newPassenger, error: insertError } = await supabase
          .from('passengers')
          .insert(passengerPayload)
          .select('id')
          .single()

        if (insertError) {
          console.error('Error creating passenger:', insertError)
          return
        }

        const { error: junctionError } = await supabase
          .from('customer_passengers')
          .insert({
            customer_id: customerId,
            passenger_id: newPassenger.id,
            label: labelValue,
          })

        if (junctionError) {
          console.error('Error creating junction:', junctionError)
          return
        }
      }

      onSaved()
    },
  })

  useEffect(() => {
    if (open) {
      setViewMode(passenger ? 'summary' : 'form')
    }
  }, [open, passenger])

  const genderLabels: Record<string, string> = {
    male: 'Male',
    female: 'Female',
  }

  const docTypeLabels: Record<string, string> = {
    cpf: 'CPF',
    rg: 'RG',
    passport: 'Passport',
    other: 'Other',
  }

  // Summary mode for existing passenger
  if (isEditing && viewMode === 'summary' && passenger.id) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Passenger</SheetTitle>
            <SheetDescription>
              Passenger details and documents.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 px-4">
            {/* Passenger summary card */}
            <div className="bg-muted/50 flex flex-col gap-2 rounded-lg border p-4">
              <p className="text-lg font-semibold">
                {passenger.full_name || 'Unnamed'}
              </p>

              {junctionLabel && (
                <p className="text-muted-foreground text-sm">
                  Label: {junctionLabel}
                </p>
              )}
              {passenger.date_of_birth && (
                <p className="text-muted-foreground text-sm">
                  Date of birth: {passenger.date_of_birth}
                </p>
              )}
              {passenger.gender && (
                <p className="text-muted-foreground text-sm">
                  Gender: {genderLabels[passenger.gender] || passenger.gender}
                </p>
              )}
              {passenger.nationality && (
                <p className="text-muted-foreground text-sm">
                  Nationality: {passenger.nationality}
                </p>
              )}
              {passenger.document_type && (
                <p className="text-muted-foreground text-sm">
                  Document:{' '}
                  {docTypeLabels[passenger.document_type] ||
                    passenger.document_type}
                  {passenger.document_number
                    ? ` — ${passenger.document_number}`
                    : ''}
                </p>
              )}
              {passenger.frequent_flyer_airline && (
                <p className="text-muted-foreground text-sm">
                  Frequent flyer: {passenger.frequent_flyer_airline}
                  {passenger.frequent_flyer_number
                    ? ` — ${passenger.frequent_flyer_number}`
                    : ''}
                </p>
              )}
              {passenger.notes && (
                <p className="text-muted-foreground text-sm">
                  {passenger.notes}
                </p>
              )}

              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('form')}
                >
                  <Pencil className="size-3" />
                  Edit
                </Button>
              </div>
            </div>

            {/* Documents */}
            <Separator />
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium">Documents</p>
                <p className="text-muted-foreground text-xs">
                  Tagged documents for this passenger.
                </p>
              </div>
              <DocumentList passengerId={passenger.id} refreshKey={0} />
            </div>

            {/* Footer */}
            <SheetFooter className="mt-auto px-0">
              <div className="flex w-full items-center justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
              </div>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  // Form mode (create or edit-form)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? 'Edit Passenger' : 'New Passenger'}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Update the passenger details below.'
              : 'Fill in the details to add a new passenger.'}
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-1 flex-col gap-4 px-4"
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
        >
          {isEditing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setViewMode('summary')}
            >
              <ArrowLeft className="size-3" />
              Back to summary
            </Button>
          )}

          <form.Field name="full_name">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="full_name">Full name *</Label>
                <Input
                  id="full_name"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Legal full name"
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-destructive text-sm">
                    {field.state.meta.errors.join(', ')}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="label">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="e.g. self, spouse, child"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="date_of_birth">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="date_of_birth">Date of birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="gender">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label>Gender</Label>
                <Select
                  value={field.state.value || '__none__'}
                  onValueChange={(v) =>
                    field.handleChange(v === '__none__' ? '' : v)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select gender..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not specified</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>

          <form.Field name="nationality">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="nationality">Nationality</Label>
                <Input
                  id="nationality"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="e.g. Brazilian"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="document_type">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label>Document type</Label>
                <Select
                  value={field.state.value || '__none__'}
                  onValueChange={(v) =>
                    field.handleChange(v === '__none__' ? '' : v)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select document type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="rg">RG</SelectItem>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>

          <form.Field name="document_number">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="document_number">Document number</Label>
                <Input
                  id="document_number"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Document number"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="frequent_flyer_airline">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="frequent_flyer_airline">
                  Frequent flyer airline
                </Label>
                <Input
                  id="frequent_flyer_airline"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="e.g. LATAM"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="frequent_flyer_number">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="frequent_flyer_number">
                  Frequent flyer number
                </Label>
                <Input
                  id="frequent_flyer_number"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Membership number"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="notes">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Optional notes..."
                  rows={3}
                />
              </div>
            )}
          </form.Field>

          <SheetFooter className="mt-auto px-0">
            <div className="flex w-full items-center justify-between">
              <div />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    isEditing ? setViewMode('summary') : onOpenChange(false)
                  }
                >
                  Cancel
                </Button>
                <Button type="submit">{isEditing ? 'Save' : 'Create'}</Button>
              </div>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
