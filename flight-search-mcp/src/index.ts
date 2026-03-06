#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { SearchInputSchema } from './types.js'
import { searchSeatsAero } from './tools/seats-aero.js'
import { searchSmiles } from './tools/smiles.js'
import { closeBrowser } from './tools/browser.js'

const server = new McpServer({
  name: 'flight-search',
  version: '0.1.0',
})

server.tool(
  'search_seats_aero',
  'Search for award flight availability on seats.aero. Returns cached miles pricing from various loyalty programs (Smiles, United, Aeroplan, etc.). Uses the seats.aero API — requires SEATS_AERO_API_KEY env var.',
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

server.tool(
  'search_smiles',
  'Search for flights on Smiles (GOL partner program). Returns miles pricing for economy/business class flights. Works with partner airlines (Air France, KLM, etc.) via congenere search. No login required for searching.',
  SearchInputSchema.shape,
  async (params) => {
    const input = SearchInputSchema.parse(params)
    const result = await searchSmiles(input)

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

// Cleanup on exit
process.on('SIGINT', async () => {
  await closeBrowser()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await closeBrowser()
  process.exit(0)
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Flight Search MCP server running on stdio')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
