import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

type Customer = Database['public']['Views']['customers_with_contact']['Row']

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
}

export function CustomerSheet({
  open,
  onOpenChange,
  customer,
  onSaved,
  onDelete,
}: CustomerSheetProps) {
  const isEditing = !!customer

  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      notes: '',
      phone_number: null as string | null,
    },
    onSubmit: async ({ value }) => {
      const parsed = customerSchema.safeParse(value)
      if (!parsed.success) return

      const payload = {
        name: parsed.data.name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        notes: parsed.data.notes || null,
        phone_number: parsed.data.phone_number || null,
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
    if (open) {
      form.reset({
        name: customer?.name ?? '',
        email: customer?.email ?? '',
        phone: customer?.phone ?? '',
        notes: customer?.notes ?? '',
        phone_number: customer?.phone_number ?? null,
      })
    }
  }, [open, customer])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? 'Edit Customer' : 'New Customer'}
          </SheetTitle>
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
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label>WhatsApp Contact</Label>
                <ContactSelect
                  value={field.state.value ?? null}
                  onChange={(v) => field.handleChange(v)}
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
              {isEditing && customer.id ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => onDelete(customer.id!)}
                >
                  Delete
                </Button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
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
