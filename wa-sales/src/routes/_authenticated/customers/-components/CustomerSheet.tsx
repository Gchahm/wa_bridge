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
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { ContactSelect } from './ContactSelect'
import { PassengerList } from './PassengerList'
import { PassengerSelect } from './PassengerSelect'
import { PassengerSheet } from './PassengerSheet'

type Customer = Database['public']['Views']['customers_with_contact']['Row']
type Passenger = Database['public']['Tables']['passengers']['Row']
type CustomerPassenger =
  Database['public']['Tables']['customer_passengers']['Row']

const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  phone_number: z.string().nullable().optional(),
})

interface CustomerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
  onSaved: () => void
  onDelete: (id: string) => void
  defaultPhoneNumber?: string
}

export function CustomerSheet({
  open,
  onOpenChange,
  customer,
  onSaved,
  onDelete,
  defaultPhoneNumber,
}: CustomerSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-y-auto">
        {open && (
          <CustomerSheetForm
            key={customer?.id ?? 'new'}
            customer={customer}
            defaultPhoneNumber={defaultPhoneNumber}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
            onDelete={onDelete}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function CustomerSheetForm({
  customer,
  defaultPhoneNumber,
  onOpenChange,
  onSaved,
  onDelete,
}: {
  customer: Customer | null
  defaultPhoneNumber?: string
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  onDelete: (id: string) => void
}) {
  const isEditing = !!customer
  const [viewMode, setViewMode] = useState<'summary' | 'form'>(
    customer ? 'summary' : 'form',
  )

  // Passenger state
  const [passengerSheetOpen, setPassengerSheetOpen] = useState(false)
  const [editingPassenger, setEditingPassenger] = useState<Passenger | null>(
    null,
  )
  const [passengerJunctionLabel, setPassengerJunctionLabel] = useState<
    string | null
  >(null)
  const [passengerPrefill, setPassengerPrefill] = useState<{
    full_name?: string
    label?: string
  } | null>(null)
  const [passengerRefreshKey, setPassengerRefreshKey] = useState(0)
  const [linkedPassengerIds, setLinkedPassengerIds] = useState<string[]>([])
  const [showAddSelf, setShowAddSelf] = useState(true)

  const form = useForm({
    defaultValues: {
      name: customer?.name ?? '',
      email: customer?.email ?? '',
      phone: customer?.phone ?? '',
      notes: customer?.notes ?? '',
      phone_number: customer?.phone_number ?? defaultPhoneNumber ?? null,
    },
    onSubmit: async ({ value }) => {
      const parsed = customerSchema.safeParse(value)
      if (!parsed.success) return

      const payload = {
        name: parsed.data.name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        notes: parsed.data.notes || null,
        phone_number: parsed.data.phone_number || defaultPhoneNumber || null,
      }

      if (isEditing && customer.id) {
        const { error } = await supabase
          .from('customers')
          .update(payload)
          .eq('id', customer.id)
        if (error) {
          console.error('Error updating customer:', error)
          return
        }
      } else {
        const { error } = await supabase.from('customers').insert(payload)
        if (error) {
          console.error('Error creating customer:', error)
          return
        }
      }

      onSaved()
    },
  })

  useEffect(() => {
    if (!isEditing || !customer.id) return

    supabase
      .from('customer_passengers')
      .select('*')
      .eq('customer_id', customer.id)
      .then(({ data }) => {
        const junctions = (data ?? []) as CustomerPassenger[]
        const ids = junctions.map((j) => j.passenger_id)
        setLinkedPassengerIds(ids)

        const hasSelf = junctions.some((j) => j.label === 'self')
        setShowAddSelf(!hasSelf)
      })
  }, [isEditing, customer?.id, passengerRefreshKey])

  function handlePassengerSaved() {
    setPassengerSheetOpen(false)
    setPassengerRefreshKey((k) => k + 1)
  }

  async function handlePassengerDelete(passengerId: string) {
    const { error } = await supabase
      .from('passengers')
      .delete()
      .eq('id', passengerId)

    if (error) {
      console.error('Error deleting passenger:', error)
      return
    }

    setPassengerSheetOpen(false)
    setPassengerRefreshKey((k) => k + 1)
  }

  // Summary mode for existing customer
  if (isEditing && viewMode === 'summary' && customer.id) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Customer</SheetTitle>
          <SheetDescription>Customer details and passengers.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 px-4">
          {/* Customer summary card */}
          <div className="bg-muted/50 flex flex-col gap-2 rounded-lg border p-4">
            <p className="text-lg font-semibold">
              {customer.name || 'Unnamed'}
            </p>

            {customer.email && (
              <p className="text-muted-foreground text-sm">
                Email: {customer.email}
              </p>
            )}
            {customer.phone && (
              <p className="text-muted-foreground text-sm">
                Phone: {customer.phone}
              </p>
            )}
            {(customer.phone_number || defaultPhoneNumber) && (
              <p className="text-muted-foreground text-sm">
                WhatsApp: {customer.phone_number || defaultPhoneNumber}
              </p>
            )}
            {customer.notes && (
              <p className="text-muted-foreground text-sm">{customer.notes}</p>
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

          {/* Passengers */}
          <Separator />

          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium">Passengers</p>
              <p className="text-muted-foreground text-xs">
                People who travel with this customer.
              </p>
            </div>

            <PassengerList
              customerId={customer.id}
              refreshKey={passengerRefreshKey}
              onEdit={(passenger, label) => {
                setEditingPassenger(passenger)
                setPassengerJunctionLabel(label)
                setPassengerPrefill(null)
                setPassengerSheetOpen(true)
              }}
              onAdd={() => {
                setEditingPassenger(null)
                setPassengerJunctionLabel(null)
                setPassengerPrefill(null)
                setPassengerSheetOpen(true)
              }}
              onAddSelf={() => {
                setEditingPassenger(null)
                setPassengerJunctionLabel(null)
                setPassengerPrefill({
                  full_name: customer.name ?? '',
                  label: 'self',
                })
                setPassengerSheetOpen(true)
              }}
              showAddSelf={showAddSelf}
            />

            <PassengerSelect
              customerId={customer.id}
              excludeIds={linkedPassengerIds}
              onLinked={() => setPassengerRefreshKey((k) => k + 1)}
            />
          </div>

          {/* Footer */}
          <SheetFooter className="mt-auto px-0">
            <div className="flex w-full items-center justify-between">
              <Button
                type="button"
                variant="destructive"
                onClick={() => onDelete(customer.id!)}
              >
                Delete
              </Button>
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

        <PassengerSheet
          open={passengerSheetOpen}
          onOpenChange={setPassengerSheetOpen}
          customerId={customer.id}
          passenger={editingPassenger}
          junctionLabel={passengerJunctionLabel}
          prefill={passengerPrefill}
          onSaved={handlePassengerSaved}
          onDelete={handlePassengerDelete}
        />
      </>
    )
  }

  // Form mode (create or edit-form)
  return (
    <>
      <SheetHeader>
        <SheetTitle>{isEditing ? 'Edit Customer' : 'New Customer'}</SheetTitle>
        <SheetDescription>
          {isEditing
            ? 'Update the customer details below.'
            : 'Fill in the details to create a new customer.'}
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

        <form.Field name="name">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="Customer name"
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-destructive text-sm">
                  {field.state.meta.errors.join(', ')}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="email">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="email@example.com"
              />
            </div>
          )}
        </form.Field>

        <form.Field name="phone">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="Non-WhatsApp phone"
              />
            </div>
          )}
        </form.Field>

        <form.Field name="phone_number">
          {(field) =>
            defaultPhoneNumber ? (
              <div className="flex flex-col gap-2">
                <Label>WhatsApp Contact</Label>
                <p className="text-muted-foreground text-sm">
                  {defaultPhoneNumber}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Label>WhatsApp Contact</Label>
                <ContactSelect
                  value={field.state.value ?? null}
                  onChange={(v) => field.handleChange(v)}
                />
              </div>
            )
          }
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

      {isEditing && customer.id && (
        <PassengerSheet
          open={passengerSheetOpen}
          onOpenChange={setPassengerSheetOpen}
          customerId={customer.id}
          passenger={editingPassenger}
          junctionLabel={passengerJunctionLabel}
          prefill={passengerPrefill}
          onSaved={handlePassengerSaved}
          onDelete={handlePassengerDelete}
        />
      )}
    </>
  )
}
