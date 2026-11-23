#!/usr/bin/env node
/*
 * Sports Jedi MCP server (stdio).
 *   SPORTS_JEDI_API_URL   default https://api.sportsjedi.com
 *   SPORTS_JEDI_API_KEY   your Sports Jedi developer API key, sj_live_… (plan limits apply)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient } from './client.js';
import { buildTools } from './tools.js';

const VERSION = '0.1.0';
const apiKey = process.env.SPORTS_JEDI_API_KEY || '';
const client = createClient({
  baseUrl: process.env.SPORTS_JEDI_API_URL || 'https://api.sportsjedi.com',
  apiKey,
  userAgent: `sports-jedi-mcp/${VERSION}`,
});

const server = new McpServer({ name: 'sports-jedi', version: VERSION });
for (const t of buildTools({ client })) {
  server.tool(t.name, t.description, t.shape, t.handler);
}
await server.connect(new StdioServerTransport());
console.error(`Sports Jedi MCP ${VERSION} running (${apiKey ? 'API key set' : 'no API key set'})`);
