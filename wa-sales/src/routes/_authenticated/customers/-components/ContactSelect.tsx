import { useEffect, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Contact = Database['public']['Views']['contacts']['Row']

interface ContactSelectProps {
  value: string | null
  onChange: (value: string | null) => void
}

export function ContactSelect({ value, onChange }: ContactSelectProps) {
  const [contacts, setContacts] = useState<Contact[]>([])

  useEffect(() => {
    supabase
      .from('contacts')
      .select('*')
      .order('push_name', { ascending: true })
      .then(({ data }) => {
        if (data) setContacts(data)
      })
  }, [])

  return (
    <Select
      value={value ?? '__none__'}
      onValueChange={(v) => onChange(v === '__none__' ? null : v)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a contact..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">No linked contact</SelectItem>
        {contacts.map((contact) => (
          <SelectItem
            key={contact.phone_number}
            value={contact.phone_number ?? ''}
          >
            {contact.push_name
              ? `${contact.push_name} (${contact.phone_number})`
              : contact.phone_number}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
