import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Plane,
  FileText,
  CheckCircle,
  BookOpen,
  UserPlus,
  MessageSquare,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { CustomerSheet } from './customers/-components/CustomerSheet'

type CustomerWithContact =
  Database['public']['Views']['customers_with_contact']['Row']
type ChatWithPreview = Database['public']['Views']['chats_with_preview']['Row']
type UnlinkedContact = Database['public']['Views']['unlinked_contacts']['Row']

const STATUS_CONFIG = [
  { key: 'new', label: 'New', icon: Plane, color: 'text-blue-600' },
  {
    key: 'quoted',
    label: 'Quoted',
    icon: FileText,
    color: 'text-amber-600',
  },
  {
    key: 'accepted',
    label: 'Accepted',
    icon: CheckCircle,
    color: 'text-green-600',
  },
  {
    key: 'booked',
    label: 'Booked',
    icon: BookOpen,
    color: 'text-purple-600',
  },
] as const

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return ''

  const date = new Date(dateStr)
  const now = new Date()

  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const Route = createFileRoute('/_authenticated/')({
  loader: async () => {
    const [requestsRes, customersRes, unlinkedRes] = await Promise.all([
      supabase.from('flight_requests').select('status'),
      supabase
        .from('customers_with_contact')
        .select('*')
        .not('phone_number', 'is', null)
        .order('wa_last_seen_at', { ascending: false, nullsFirst: false })
        .limit(10),
      supabase.from('unlinked_contacts').select('*').limit(10),
    ])

    if (requestsRes.error)
      console.error('Error fetching requests:', requestsRes.error)
    if (customersRes.error)
      console.error('Error fetching customers:', customersRes.error)
    if (unlinkedRes.error)
      console.error('Error fetching unlinked:', unlinkedRes.error)

    const requests = requestsRes.data ?? []
    const customers = customersRes.data ?? []
    const unlinked = unlinkedRes.data ?? []

    // Fetch chat previews for the customers' phone numbers
    const phoneNumbers = customers
      .map((c) => c.phone_number)
      .filter((p): p is string => p !== null)

    let chatPreviews: ChatWithPreview[] = []
    if (phoneNumbers.length > 0) {
      const { data, error } = await supabase
        .from('chats_with_preview')
        .select('*')
        .in('contact_phone_number', phoneNumbers)
      if (error) console.error('Error fetching chat previews:', error)
      chatPreviews = data ?? []
    }

    // Count requests by status
    const statusCounts: Record<string, number> = {}
    for (const r of requests) {
      if (r.status) {
        statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1
      }
    }

    return { statusCounts, customers, chatPreviews, unlinked }
  },

  component: Dashboard,
})

function Dashboard() {
  const { statusCounts, customers, chatPreviews, unlinked } =
    Route.useLoaderData()

  const chatByPhone = new Map<string, ChatWithPreview>()
  for (const chat of chatPreviews) {
    if (chat.contact_phone_number) {
      chatByPhone.set(chat.contact_phone_number, chat)
    }
  }

  const [customerSheetOpen, setCustomerSheetOpen] = useState(false)
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string | null>(
    null,
  )

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      {/* Section 1: Open Requests */}
      <section className="mb-8">
        <h2 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">
          Open Requests
        </h2>
        <Link to="/requests" className="block">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {STATUS_CONFIG.map(({ key, label, icon: Icon, color }) => (
              <Card key={key} className="transition-colors hover:bg-accent/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{label}</CardTitle>
                  <Icon className={`size-4 ${color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statusCounts[key] ?? 0}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </Link>
      </section>

      {/* Section 2: Recent Customer Activity */}
      <section className="mb-8">
        <h2 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">
          Recent Customer Activity
        </h2>
        {customers.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No recent customer activity.
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {customers.map((customer) => (
              <CustomerActivityRow
                key={customer.id}
                customer={customer}
                chat={
                  customer.phone_number
                    ? chatByPhone.get(customer.phone_number)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Section 3: Unlinked Contacts */}
      <section>
        <h2 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">
          Unlinked Contacts
        </h2>
        {unlinked.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            All contacts are linked to customers.
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {unlinked.map((contact) => (
              <UnlinkedContactRow
                key={contact.phone_number}
                contact={contact}
                onClick={() => {
                  setSelectedPhoneNumber(contact.phone_number)
                  setCustomerSheetOpen(true)
                }}
              />
            ))}
          </div>
        )}
      </section>

      <CustomerSheet
        open={customerSheetOpen}
        onOpenChange={setCustomerSheetOpen}
        customer={null}
        onSaved={() => {
          setCustomerSheetOpen(false)
          setSelectedPhoneNumber(null)
        }}
        defaultPhoneNumber={selectedPhoneNumber ?? undefined}
      />
    </div>
  )
}

function CustomerActivityRow({
  customer,
  chat,
}: {
  customer: CustomerWithContact
  chat: ChatWithPreview | undefined
}) {
  const displayName = customer.name ?? 'Unknown'
  const pushName = customer.wa_push_name
  const showPushName = pushName && pushName !== displayName
  const lastMessage = chat?.last_message_content
  const time = formatRelativeTime(
    chat?.last_message_timestamp ?? customer.wa_last_seen_at,
  )

  if (chat?.chat_id) {
    return (
      <Link
        to="/chat"
        search={{ chatId: chat.chat_id }}
        className="hover:bg-accent/50 flex items-center gap-3 px-4 py-3 transition-colors"
      >
        <CustomerActivityContent
          displayName={displayName}
          showPushName={showPushName}
          pushName={pushName}
          lastMessage={lastMessage}
          time={time}
        />
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <CustomerActivityContent
        displayName={displayName}
        showPushName={showPushName}
        pushName={pushName}
        lastMessage={lastMessage}
        time={time}
      />
    </div>
  )
}

function CustomerActivityContent({
  displayName,
  showPushName,
  pushName,
  lastMessage,
  time,
}: {
  displayName: string
  showPushName: boolean | string | null
  pushName: string | null
  lastMessage: string | null | undefined
  time: string
}) {
  return (
    <>
      <MessageSquare className="text-muted-foreground size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{displayName}</span>
          {showPushName && (
            <span className="text-muted-foreground truncate text-xs">
              ({pushName})
            </span>
          )}
        </div>
        {lastMessage && (
          <p className="text-muted-foreground truncate text-xs">
            {lastMessage}
          </p>
        )}
      </div>
      {time && (
        <span className="text-muted-foreground shrink-0 text-xs">{time}</span>
      )}
    </>
  )
}

function UnlinkedContactRow({
  contact,
  onClick,
}: {
  contact: UnlinkedContact
  onClick: () => void
}) {
  const displayName = contact.push_name ?? contact.phone_number ?? 'Unknown'
  const time = formatRelativeTime(contact.last_seen_at)

  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-accent/50 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
    >
      <UserPlus className="text-muted-foreground size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="truncate text-sm font-medium">{displayName}</span>
        {contact.push_name && contact.phone_number && (
          <p className="text-muted-foreground text-xs">
            {contact.phone_number}
          </p>
        )}
      </div>
      {time && (
        <span className="text-muted-foreground shrink-0 text-xs">{time}</span>
      )}
    </button>
  )
}
