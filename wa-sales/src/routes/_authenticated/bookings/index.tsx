import { useState, useMemo } from 'react'
import { createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
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
import { BookingSheet } from './-components/BookingSheet'

type BookingSummary = Database['public']['Views']['bookings_summary']['Row']
type Booking = Database['public']['Tables']['bookings']['Row']

const parentRoute = getRouteApi('/_authenticated/bookings')

export const Route = createFileRoute('/_authenticated/bookings/')({
  component: BookingsPage,
})

const statusColors: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-800',
  ticketed: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-gray-100 text-gray-800',
}

const columns: ColumnDef<BookingSummary>[] = [
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
      const o = row.original.route_origin
      const d = row.original.route_destination
      if (!o && !d) return '—'
      return `${o || '?'} → ${d || '?'}`
    },
  },
  {
    id: 'departure',
    header: 'Departure',
    cell: ({ row }) => {
      const dt = row.original.departure_at_display
      if (!dt) return '—'
      try {
        return new Date(dt).toLocaleDateString('pt-BR')
      } catch {
        return String(dt)
      }
    },
  },
  {
    accessorKey: 'pnr',
    header: 'PNR',
    cell: ({ row }) => row.original.pnr || '—',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status ?? 'confirmed'
      return (
        <Badge className={statusColors[status]} variant="secondary">
          {status}
        </Badge>
      )
    },
  },
  {
    id: 'price',
    header: 'Price',
    cell: ({ row }) => {
      const price = row.original.total_price
      const currency = row.original.currency
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
]

type TabValue = 'active' | 'completed' | 'cancelled'

const activeStatuses = new Set(['confirmed', 'ticketed'])
const cancelledStatuses = new Set(['cancelled', 'no_show'])

function BookingsPage() {
  const { bookings } = parentRoute.useLoaderData()
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [activeTab, setActiveTab] = useState<TabValue>('active')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(
    null,
  )

  const filteredData = useMemo(() => {
    return bookings.filter((b) => {
      const status = b.status ?? 'confirmed'
      if (activeTab === 'active') return activeStatuses.has(status)
      if (activeTab === 'completed') return status === 'completed'
      return cancelledStatuses.has(status)
    })
  }, [bookings, activeTab])

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

  async function handleRowClick(summary: BookingSummary) {
    if (!summary.id) return

    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', summary.id)
      .single()

    if (data) {
      setEditingBooking(data)
      setEditingCustomerId(summary.customer_id)
      setSheetOpen(true)
    }
  }

  function handleSaved() {
    setSheetOpen(false)
    setEditingBooking(null)
    router.invalidate()
  }

  function handleNewBooking() {
    setEditingBooking(null)
    setEditingCustomerId(null)
    setSheetOpen(true)
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <Button onClick={handleNewBooking}>New Booking</Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
      >
        <div className="flex items-center gap-4">
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
          <Input
            placeholder="Search bookings..."
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
                  No bookings found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <BookingSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        customerId={editingCustomerId}
        booking={editingBooking}
        onSaved={handleSaved}
      />
    </div>
  )
}
