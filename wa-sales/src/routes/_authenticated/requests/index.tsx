import { useState, useMemo } from 'react'
import {
  createFileRoute,
  getRouteApi,
  useRouter,
  Link,
} from '@tanstack/react-router'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { ArrowUpDown, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { RequestSheet } from './-components/RequestSheet'

type FlightRequestSummary =
  Database['public']['Views']['flight_requests_summary']['Row']
type FlightRequest = Database['public']['Views']['flight_requests']['Row']

const parentRoute = getRouteApi('/_authenticated/requests')

export const Route = createFileRoute('/_authenticated/requests/')({
  component: RequestsPage,
})

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  quoted: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-green-100 text-green-800',
  booked: 'bg-purple-100 text-purple-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
}

const cabinClassLabels: Record<string, string> = {
  economy: 'Economy',
  premium_economy: 'Premium',
  business: 'Business',
  first: 'First',
}

const columns: ColumnDef<FlightRequestSummary>[] = [
  {
    accessorKey: 'customer_name',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Customer
        <ArrowUpDown className="ml-1 size-3" />
      </Button>
    ),
    cell: ({ row }) => row.original.customer_name || '—',
  },
  {
    id: 'route',
    header: 'Route',
    cell: ({ row }) => {
      const o = row.original.origin
      const d = row.original.destination
      if (!o && !d) return '—'
      return `${o || '?'} → ${d || '?'}`
    },
  },
  {
    id: 'departure',
    header: 'Departure',
    cell: ({ row }) => {
      const s = row.original.departure_date_start
      if (!s) return '—'
      try {
        return new Date(s + 'T00:00:00').toLocaleDateString('pt-BR')
      } catch {
        return s
      }
    },
  },
  {
    id: 'pax',
    header: 'Pax',
    cell: ({ row }) => {
      const a = row.original.adults ?? 0
      const c = row.original.children ?? 0
      const i = row.original.infants ?? 0
      return a + c + i
    },
  },
  {
    accessorKey: 'cabin_class',
    header: 'Class',
    cell: ({ row }) => {
      const cls = row.original.cabin_class ?? 'economy'
      return <Badge variant="outline">{cabinClassLabels[cls] ?? cls}</Badge>
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status ?? 'new'
      return (
        <Badge className={statusColors[status]} variant="secondary">
          {status}
        </Badge>
      )
    },
  },
  {
    id: 'quote',
    header: 'Quote',
    cell: ({ row }) => {
      const price = row.original.selected_quote_price
      const currency = row.original.selected_quote_currency
      if (price == null) return '—'
      return `${currency ?? 'BRL'} ${Number(price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    },
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    cell: ({ row }) => {
      const date = row.original.created_at
      if (!date) return '—'
      return new Date(date).toLocaleDateString('pt-BR')
    },
  },
  {
    id: 'chat',
    header: '',
    cell: ({ row }) => {
      const chatId = row.original.chat_id
      if (!chatId) return null
      return (
        <Link
          to="/chat"
          search={{ chatId }}
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground"
          title="Open chat"
        >
          <MessageSquare className="size-4" />
        </Link>
      )
    },
  },
]

type TabValue = 'open' | 'completed' | 'cancelled'

const openStatuses = new Set(['new', 'quoted', 'accepted', 'booked'])

function RequestsPage() {
  const { requests } = parentRoute.useLoaderData()
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [activeTab, setActiveTab] = useState<TabValue>('open')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingRequest, setEditingRequest] = useState<FlightRequest | null>(
    null,
  )
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(
    null,
  )

  const filteredData = useMemo(() => {
    return requests.filter((r) => {
      const status = r.status ?? 'new'
      if (activeTab === 'open') return openStatuses.has(status)
      if (activeTab === 'completed') return status === 'completed'
      return status === 'cancelled'
    })
  }, [requests, activeTab])

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  async function handleRowClick(summary: FlightRequestSummary) {
    if (!summary.id) return

    // Fetch full request data
    const { data } = await supabase
      .from('flight_requests')
      .select('*')
      .eq('id', summary.id)
      .single()

    if (data) {
      setEditingRequest(data)
      setEditingCustomerId(summary.customer_id)
      setSheetOpen(true)
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase
      .from('flight_requests')
      .delete()
      .eq('id', id)
    if (error) {
      console.error('Error deleting request:', error)
      return
    }
    setSheetOpen(false)
    setEditingRequest(null)
    router.invalidate()
  }

  function handleSaved() {
    setSheetOpen(false)
    setEditingRequest(null)
    router.invalidate()
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Flight Requests</h1>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
      >
        <div className="flex items-center gap-4">
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
          <Input
            placeholder="Search requests..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </Tabs>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No requests found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {editingCustomerId && (
        <RequestSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          customerId={editingCustomerId}
          request={editingRequest}
          onSaved={handleSaved}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
