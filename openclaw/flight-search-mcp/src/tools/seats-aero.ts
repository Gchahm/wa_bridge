import type { SearchInput, SearchResult, FlightResult } from '../types.js'

const BASE_URL = 'https://seats.aero/partnerapi'

function getApiKey(): string {
  const key = process.env.SEATS_AERO_API_KEY
  if (!key) throw new Error('SEATS_AERO_API_KEY environment variable is required')
  return key
}

interface AvailabilityTrip {
  ID: string
  TotalDuration: number
  Stops: number
  Carriers: string
  RemainingSeats: number
  MileageCost: number
  TotalTaxes: number
  TaxesCurrency: string
  OriginAirport: string
  DestinationAirport: string
  Connections?: string[]
  Aircraft?: string[]
  FlightNumbers: string
  DepartsAt: string
  ArrivesAt: string
  Cabin: string
  Source: string
}

interface AvailabilityRoute {
  OriginAirport: string
  DestinationAirport: string
  Source: string
}

interface AvailabilityResult {
  ID: string
  Route: AvailabilityRoute
  Date: string
  Source: string
  UpdatedAt: string
  AvailabilityTrips: AvailabilityTrip[]
}

interface CachedSearchResponse {
  data: AvailabilityResult[]
  count: number
  hasMore: boolean
  cursor: number
}

function cabinFilter(cabin: string): string | undefined {
  const map: Record<string, string> = {
    economy: 'economy',
    business: 'business',
    first: 'first',
  }
  return map[cabin]
}

function cabinLabel(cabin: string): string {
  const map: Record<string, string> = {
    economy: 'Economy',
    premium: 'Premium Economy',
    business: 'Business',
    first: 'First',
  }
  return map[cabin] || cabin
}

function buildFlights(data: AvailabilityResult[], input: SearchInput): FlightResult[] {
  const flights: FlightResult[] = []

  for (const item of data) {
    const trips = item.AvailabilityTrips || []

    for (const trip of trips) {
      // Filter by cabin
      if (input.cabin !== 'any' && trip.Cabin !== input.cabin) continue
      // Filter by seats
      if (trip.RemainingSeats < input.passengers) continue
      // Skip zero-cost
      if (trip.MileageCost <= 0) continue

      flights.push({
        site: 'seats.aero',
        programa: trip.Source || item.Source,
        programa_key: 'seats_aero',
        tipo: 'miles',
        classe: cabinLabel(trip.Cabin),
        origem: trip.OriginAirport,
        destino: trip.DestinationAirport,
        data_ida: item.Date,
        passageiros: input.passengers,
        milhas: trip.MileageCost,
        taxas_usd: trip.TotalTaxes > 0 ? trip.TotalTaxes / 100 : undefined,
        escalas: trip.Stops,
        conexoes: trip.Connections,
        duracao_min: trip.TotalDuration,
        companhia: trip.Carriers,
        aeronaves: trip.Aircraft,
        voos: trip.FlightNumbers,
        horario_ida: trip.DepartsAt,
        horario_chegada: trip.ArrivesAt,
        assentos_disponiveis: trip.RemainingSeats,
        link: `https://seats.aero/search?origins=${input.origin}&destinations=${input.destination}&date=${item.Date}`,
        observacao: `Emissão via ${trip.Source}. Dados atualizados em ${item.UpdatedAt}.`,
      })
    }
  }

  return flights
}

export async function searchSeatsAero(input: SearchInput): Promise<SearchResult> {
  try {
    const apiKey = getApiKey()

    const days = input.date_range_days ?? 0
    const depDate = new Date(input.departure_date)
    const startDate = new Date(depDate)
    startDate.setDate(startDate.getDate() - days)
    const endDate = new Date(depDate)
    endDate.setDate(endDate.getDate() + days)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)

    const params = new URLSearchParams({
      origin_airport: input.origin,
      destination_airport: input.destination,
      start_date: fmt(startDate),
      end_date: fmt(endDate),
      take: '500',
      include_trips: 'true',
    })

    const cabinParam = cabinFilter(input.cabin)
    if (cabinParam) {
      params.set('cabins', cabinParam)
    }

    const response = await fetch(`${BASE_URL}/search?${params}`, {
      headers: {
        'Partner-Authorization': apiKey,
        'Accept': 'application/json',
      },
    })

    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        flights: [],
        date_prices: [],
        requires_login: true,
        error: 'seats.aero API key is invalid or expired. Check SEATS_AERO_API_KEY.',
      }
    }

    if (!response.ok) {
      return {
        success: false,
        flights: [],
        date_prices: [],
        error: `seats.aero API returned ${response.status}: ${await response.text()}`,
      }
    }

    const body = (await response.json()) as CachedSearchResponse
    const flights = buildFlights(body.data || [], input)

    return {
      success: true,
      flights,
      date_prices: [],
    }
  } catch (error) {
    return {
      success: false,
      flights: [],
      date_prices: [],
      error: `seats.aero search failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
