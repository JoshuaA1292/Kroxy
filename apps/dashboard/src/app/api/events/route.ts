import { NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const escrowId = searchParams.get('escrowId');

  const upstreamUrl = `${API_URL}/api/audit/stream${escrowId ? `?escrowId=${escrowId}` : ''}`;

  const upstream = await fetch(upstreamUrl, {
    headers: { Accept: 'text/event-stream' },
  });

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
