import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// The MCP SDK tool() generic can trigger excessive recursive type instantiation
// in CI with some zod schema combinations. Use a thin any-typed bridge so
// registration stays type-safe enough at runtime without blocking compilation.
export function registerTool(server: McpServer, ...args: any[]): any {
  return (server as any).tool(...args);
}
