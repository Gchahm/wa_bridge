#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { SearchInputSchema } from './types.js'
import { searchSeatsAero } from './tools/seats-aero.js'

const server = new McpServer({
  name: 'flight-search',
  version: '0.1.0',
})

server.tool(
  'search_flights_seats_aero',
  'Search for award flight availability on seats.aero. Returns cached miles pricing from multiple loyalty programs (Smiles, United, Aeroplan, Flying Blue, etc.). Use date_range_days to search +/- days around the departure date.',
  SearchInputSchema.shape,
  async (params) => {
    const input = SearchInputSchema.parse(params)
    const result = await searchSeatsAero(input)

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    }
  }
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Flight Search MCP server running on stdio')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
