/**
 * Lava AI Gateway — forward proxy helper for the Kroxy API server.
 *
 * Routes Anthropic API calls through https://api.lava.so so all LLM
 * inference costs are tracked and attributed in the Lava dashboard.
 *
 * Docs: https://docs.lava.build/gateway/forward-proxy
 */

interface AnthropicMessageOpts {
  model: string;
  max_tokens: number;
  system?: string;
  messages: Array<{ role: string; content: string }>;
}

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
}

const LAVA_ANTHROPIC_URL =
  'https://api.lava.so/v1/forward?u=https%3A%2F%2Fapi.anthropic.com%2Fv1%2Fmessages';

/** Returns true when both LAVA_SECRET_KEY and ANTHROPIC_API_KEY are present. */
export function lavaAvailable(): boolean {
  return !!(process.env.LAVA_SECRET_KEY && process.env.ANTHROPIC_API_KEY);
}

/**
 * Call the Anthropic Messages API via Lava's forward proxy.
 * Falls back to direct Anthropic call if LAVA_SECRET_KEY is absent.
 */
export async function lavaAnthropic(opts: AnthropicMessageOpts): Promise<string> {
  const lavaKey = process.env.LAVA_SECRET_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? '';

  // ── Lava path ────────────────────────────────────────────────────────────────
  if (lavaKey) {
    const res = await fetch(LAVA_ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lavaKey}`,
        'anthropic-version': '2023-06-01',
        'x-api-key': anthropicKey,
      },
      body: JSON.stringify(opts),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Lava/Anthropic ${res.status}: ${body}`);
    }

    const data = (await res.json()) as AnthropicResponse;
    return data.content[0]?.text ?? '';
  }

  // ── Direct Anthropic fallback (no Lava key) ───────────────────────────────
  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY is not set');
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: anthropicKey });
  const msg = await client.messages.create({
    model: opts.model,
    max_tokens: opts.max_tokens,
    ...(opts.system ? { system: opts.system } : {}),
    messages: opts.messages as Parameters<typeof client.messages.create>[0]['messages'],
  });
  const block = msg.content[0] as { type: string; text?: string };
  return block.text ?? '';
}
