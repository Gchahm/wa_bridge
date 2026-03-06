import type { Page } from 'playwright'
import { getBrowserContext } from './browser.js'
import type {
  SearchInput,
  SearchResult,
  FlightResult,
  DatePrice,
} from '../types.js'

function dateToEpochMs(dateStr: string): number {
  // Smiles expects epoch milliseconds at noon BRT (UTC-3) = 15:00 UTC
  const date = new Date(`${dateStr}T15:00:00.000Z`)
  return date.getTime()
}

function buildSearchUrl(input: SearchInput): string {
  const cabinMap: Record<string, string> = {
    economy: 'ECONOMIC',
    business: 'EXECUTIVE',
    first: 'FIRST',
    any: 'ALL',
  }

  const params = new URLSearchParams({
    adults: String(input.passengers),
    cabin: cabinMap[input.cabin] || 'ALL',
    children: '0',
    departureDate: String(dateToEpochMs(input.departure_date)),
    infants: '0',
    isElegible: 'false',
    isFlexibleDateChecked: 'false',
    returnDate: '',
    searchType: 'congenere',
    segments: '1',
    tripType: '2', // one-way
    originAirport: input.origin,
    originCity: '',
    originCountry: '',
    originAirportIsAny: 'false',
    destinationAirport: input.destination,
    destinCity: '',
    destinCountry: '',
    destinAirportIsAny: 'false',
    'novo-resultado-voos': 'true',
  })
  return `https://www.smiles.com.br/mfe/emissao-passagem/?${params}`
}

async function dismissCookieBanner(page: Page): Promise<void> {
  try {
    const acceptBtn = page.getByRole('button', { name: 'Aceitar' })
    if (await acceptBtn.isVisible({ timeout: 3000 })) {
      await acceptBtn.click()
    }
  } catch {
    // Cookie banner may not appear
  }
}

async function waitForResults(page: Page): Promise<'results' | 'no_results' | 'timeout'> {
  // Smiles micro-frontend renders content that Playwright's visibility checks
  // can't always detect. Poll the page text content instead.
  const startTime = Date.now()
  const timeout = 90000

  while (Date.now() - startTime < timeout) {
    const bodyText = await page.evaluate(() => document.body.innerText)

    if (bodyText.includes('Selecionar tarifa') || bodyText.includes('milhas por viajante')) {
      return 'results'
    }
    if (bodyText.includes('Não encontramos voos') || bodyText.includes('não há voos disponíveis')) {
      return 'no_results'
    }

    await page.waitForTimeout(3000)
  }

  // Final check: the page text may have results even if selectors didn't match
  const finalText = await page.evaluate(() => document.body.innerText)
  if (finalText.includes('milhas')) {
    return 'results'
  }

  return 'timeout'
}

async function parseResults(
  page: Page,
  input: SearchInput
): Promise<{ flights: FlightResult[]; datePrices: DatePrice[] }> {
  const flights: FlightResult[] = []
  const datePrices: DatePrice[] = []

  // Give time for all results to render
  await page.waitForTimeout(5000)

  // Extract all relevant lines from page text
  const bodyText = await page.evaluate(() => document.body.innerText)
  const lines = bodyText.split('\n').map((l: string) => l.trim()).filter(Boolean)

  // Parse date carousel: dates and miles appear as separate lines in sequence
  // Pattern in lines: "Seg, 23 mar" followed by "314.700 milhas" (or similar)
  const monthMap: Record<string, string> = {
    jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
    jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
  }
  const year = input.departure_date.split('-')[0]

  for (let i = 0; i < lines.length; i++) {
    const dateMatch = lines[i].match(
      /^(?:Seg|Ter|Qua|Qui|Sex|Sab|Dom|seg|ter|qua|qui|sex|sab|dom),?\s*(\d{1,2})\s*(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/i
    )
    if (dateMatch && i + 1 < lines.length) {
      const milesMatch = lines[i + 1].match(/^([\d.]+)\s*milhas$/i)
      if (milesMatch) {
        const day = dateMatch[1].padStart(2, '0')
        const month = monthMap[dateMatch[2].toLowerCase()]
        const miles = parseInt(milesMatch[1].replace(/\./g, ''))
        datePrices.push({ date: `${year}-${month}-${day}`, miles })
      }
    }
  }

  // Parse flight cards by splitting on "Selecionar tarifa"
  // Each flight card has this line sequence:
  //   "AIR FRANCE•Econômica"
  //   "VCP 19h40"
  //   "DUB 07h50"
  //   "Campinas" / "Dublin"
  //   "2 paradas"
  //   "57h10min"
  //   ...
  //   "A partir de 314.700 milhas por viajante"
  //   "Selecionar tarifa"
  const sections = bodyText.split('Selecionar tarifa')

  for (const section of sections) {
    const sLines = section.split('\n').map((l: string) => l.trim()).filter(Boolean)

    let airline = ''
    let cabin = ''
    let departTime = ''
    let arriveTime = ''
    let stops = ''
    let duration = ''
    let miles = 0

    for (const line of sLines) {
      // Airline + cabin: "AIR FRANCE•Econômica" or "KLM•Econômica"
      const airlineMatch = line.match(/^(.+?)[•·]\s*(Econ[oô]mica|Executiva|Primeira|Premium)/i)
      if (airlineMatch) {
        airline = airlineMatch[1].trim()
        cabin = airlineMatch[2].trim()
      }

      // Origin time: "VCP 19h40"
      const originTimeMatch = line.match(new RegExp(`^${input.origin}\\s+(\\d{1,2}h\\d{2})$`))
      if (originTimeMatch) departTime = originTimeMatch[1]

      // Destination time: "DUB 07h50"
      const destTimeMatch = line.match(new RegExp(`^${input.destination}\\s+(\\d{1,2}h\\d{2})$`))
      if (destTimeMatch) arriveTime = destTimeMatch[1]

      // Stops: "2 paradas" or "1 parada" or "Direto"
      const stopsMatch = line.match(/^(\d+)\s*parada/i)
      if (stopsMatch) stops = stopsMatch[1]
      if (line === 'Direto') stops = '0'

      // Duration: "28h30min"
      const durationMatch = line.match(/^(\d+h\d+min)$/)
      if (durationMatch) duration = durationMatch[1]

      // Miles: "A partir de 314.700 milhas por viajante"
      const milesMatch = line.match(/A partir de\s+([\d.]+)\s*milhas/i)
      if (milesMatch) miles = parseInt(milesMatch[1].replace(/\./g, ''))
    }

    if (airline && miles > 0) {
      flights.push({
        site: 'Smiles',
        programa: 'Smiles',
        programa_key: 'smiles',
        tipo: 'miles',
        classe: cabin || 'Econômica',
        origem: input.origin,
        destino: input.destination,
        data_ida: input.departure_date,
        passageiros: input.passengers,
        milhas: miles,
        escalas: stops || 'N/A',
        duracao: duration,
        companhia: airline,
        horario_ida: departTime,
        horario_chegada: arriveTime,
        link: buildSearchUrl(input),
        observacao: 'Milhas por viajante. Taxas cobradas separadamente.',
      })
    }
  }

  return { flights, datePrices }
}

export async function searchSmiles(input: SearchInput): Promise<SearchResult> {
  const ctx = await getBrowserContext()
  const page = await ctx.newPage()

  try {
    // Navigate directly to search results URL
    const url = buildSearchUrl(input)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

    await dismissCookieBanner(page)

    // Wait for the page's JS framework to mount
    await page.waitForTimeout(5000)

    // Wait for results
    const status = await waitForResults(page)

    if (status === 'no_results') {
      return {
        success: true,
        flights: [],
        date_prices: [],
        error: 'No flights found for this route/date on Smiles.',
      }
    }

    if (status === 'timeout') {
      // Check if still loading
      const stillLoading = await page
        .locator('text=Aguarde enquanto buscamos')
        .isVisible()
        .catch(() => false)

      if (stillLoading) {
        return {
          success: false,
          flights: [],
          date_prices: [],
          error:
            'Smiles search timed out after 90 seconds. The site may be slow for international routes. Try again.',
        }
      }

      return {
        success: false,
        flights: [],
        date_prices: [],
        error: 'Smiles search timed out. The page may not have loaded correctly.',
      }
    }

    // Parse results
    const { flights, datePrices } = await parseResults(page, input)

    return {
      success: true,
      flights,
      date_prices: datePrices,
    }
  } catch (error) {
    return {
      success: false,
      flights: [],
      date_prices: [],
      error: `Smiles search failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  } finally {
    await page.close()
  }
}
