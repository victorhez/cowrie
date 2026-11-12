/**
 * Cowrie MCP server (stdio). Two read-only tools: cowrie_score and cowrie_circle_status.
 * Reads the NEAR testnet contracts directly; it holds no keys and cannot move funds.
 *   npm run mcp
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getScore } from "../../src/lib/score";
import { circleStatus } from "../../src/lib/chain-facts";

const server = new McpServer({ name: "cowrie", version: "0.1.0" });
const text = (o: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(o, null, 2) }] });
const fail = (m: string) => ({ isError: true, content: [{ type: "text" as const, text: m }] });

server.tool("cowrie_score", "Cowrie Score (0-1000) for a NEAR testnet account, with the credentials and formula terms behind it.",
  { account: z.string().describe("testnet account id, e.g. alice.testnet") },
  async ({ account }) => { try { return text(await getScore(account)); } catch (e) { return fail(`could not read chain: ${e}`); } });

server.tool("cowrie_circle_status", "Live status of a Cowrie savings circle: rules, members, current round, who has not paid, deadline, safety pot.",
  { circle: z.number().int().min(0).describe("circle id on the testnet contract") },
  async ({ circle }) => { try { const s = await circleStatus(circle); return s ? text(s) : fail(`circle ${circle} does not exist`); } catch (e) { return fail(`could not read chain: ${e}`); } });

await server.connect(new StdioServerTransport());
