import type { SearchInput, SearchResult, FlightResult } from '../types.js'

const BASE_URL = 'https://seats.aero/partnerapi'

function getApiKey(): string {
  const key = process.env.SEATS_AERO_API_KEY
  if (!key) throw new Error('SEATS_AERO_API_KEY environment variable is required')
  return key
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
  ParsedDate: string
  YAvailable: boolean
  WAvailable: boolean
  JAvailable: boolean
  FAvailable: boolean
  YMileageCost: string
  WMileageCost: string
  JMileageCost: string
  FMileageCost: string
  YRemainingSeats: number
  WRemainingSeats: number
  JRemainingSeats: number
  FRemainingSeats: number
  YAirlines: string
  WAirlines: string
  JAirlines: string
  FAirlines: string
  YDirect: boolean
  WDirect: boolean
  JDirect: boolean
  FDirect: boolean
  Source: string
  UpdatedAt: string
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

function parseMileageCost(cost: string): number {
  if (!cost || cost === '0') return 0
  return parseInt(cost.replace(/,/g, ''), 10)
}

function buildFlights(data: AvailabilityResult[], input: SearchInput): FlightResult[] {
  const flights: FlightResult[] = []

  for (const item of data) {
    const cabins = [
      { key: 'Y', name: 'Economy', available: item.YAvailable, miles: item.YMileageCost, seats: item.YRemainingSeats, airlines: item.YAirlines, direct: item.YDirect },
      { key: 'W', name: 'Premium Economy', available: item.WAvailable, miles: item.WMileageCost, seats: item.WRemainingSeats, airlines: item.WAirlines, direct: item.WDirect },
      { key: 'J', name: 'Business', available: item.JAvailable, miles: item.JMileageCost, seats: item.JRemainingSeats, airlines: item.JAirlines, direct: item.JDirect },
      { key: 'F', name: 'First', available: item.FAvailable, miles: item.FMileageCost, seats: item.FRemainingSeats, airlines: item.FAirlines, direct: item.FDirect },
    ]

    // Filter by requested cabin
    const relevantCabins = input.cabin === 'any'
      ? cabins
      : cabins.filter((c) => c.name.toLowerCase().startsWith(input.cabin))

    for (const cabin of relevantCabins) {
      if (!cabin.available) continue
      const miles = parseMileageCost(cabin.miles)
      if (miles === 0) continue
      if (cabin.seats < input.passengers) continue

      flights.push({
        site: 'seats.aero',
        programa: item.Source || item.Route.Source,
        programa_key: 'seats_aero',
        tipo: 'miles',
        classe: cabin.name,
        origem: item.Route.OriginAirport,
        destino: item.Route.DestinationAirport,
        data_ida: item.Date,
        passageiros: input.passengers,
        milhas: miles,
        escalas: cabin.direct ? 0 : 'N/A',
        companhia: cabin.airlines || undefined,
        link: `https://seats.aero/search?origins=${input.origin}&destinations=${input.destination}&date=${item.Date}`,
        observacao: `${cabin.seats} seats available. Via ${item.Source}. Updated ${item.UpdatedAt}.`,
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
