import { z } from 'zod'

export const SearchInputSchema = z.object({
  origin: z.string().length(3).describe('IATA airport code (e.g. VCP, GRU)'),
  destination: z.string().length(3).describe('IATA airport code (e.g. DUB, LIS)'),
  departure_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('Departure date in YYYY-MM-DD format'),
  passengers: z.number().int().min(1).max(9).default(1),
  cabin: z
    .enum(['economy', 'business', 'first', 'any'])
    .default('economy')
    .describe('Cabin class'),
  date_range_days: z
    .number()
    .int()
    .min(0)
    .max(30)
    .default(0)
    .describe('Search +/- this many days around the departure date. 0 = exact date only.'),
})

export type SearchInput = z.infer<typeof SearchInputSchema>

export interface FlightResult {
  site: string
  programa: string
  programa_key: string | null
  tipo: 'cash' | 'miles'
  classe: string
  origem: string
  destino: string
  data_ida: string
  passageiros: number
  milhas?: number
  taxas_brl?: number
  preco_brl?: number
  escalas: number | string
  duracao?: string
  companhia?: string
  horario_ida?: string
  horario_chegada?: string
  link: string
  observacao: string
}

export interface DatePrice {
  date: string
  miles?: number
  price_brl?: number
}

export interface SearchResult {
  success: boolean
  flights: FlightResult[]
  date_prices: DatePrice[]
  error?: string
  requires_login?: boolean
}
