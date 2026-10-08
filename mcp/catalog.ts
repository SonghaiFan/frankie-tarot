import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Locale, TarotSpread } from './shared';

export const SPREAD_IDS = ['SINGLE','THREE','COURT','FOUR','FIVE','TIMELINE','DIMENSION','CELTIC','RELATION','GOALS','YEARLY'] as [string, ...string[]];
export const localeSchema = z.enum(['en', 'zh-CN']);
export const spreadSchema = z.object({
  id:z.string(), name:z.string(), description:z.string(),
  cardCount:z.number().int().positive(), labels:z.array(z.string()),
});

export async function callCoreTool(name: string, args: Record<string, unknown>) {
  const endpoint = process.env.CORE_MCP_URL;
  if (!endpoint) throw new Error('CORE_MCP_URL must point to the independent F.Tarot Agent MCP service.');
  const client = new Client({ name: 'frankie-tarot-app-adapter', version: '1.0.0' });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) throw new Error((Array.isArray(result.content) ? result.content : []).map((item: any) => item.type === 'text' ? item.text : '').join('\n') || `Core MCP tool ${name} failed.`);
    return result.structuredContent as Record<string, unknown>;
  } finally {
    await client.close().catch(() => undefined);
  }
}

export async function listSpreads(locale: Locale, invokeCore = callCoreTool): Promise<TarotSpread[]> {
  const result = await invokeCore('list_tarot_spreads', { locale });
  const spreads = result.spreads as unknown[];
  if (!Array.isArray(spreads) || spreads.length !== 11) throw new Error('Core MCP returned an invalid spread catalog.');
  return spreads.map((spread: any) => ({ id: spread.id, name: spread.name, description: spread.description,
    cardCount: spread.cardCount, labels: spread.labels }));
}
