import { API_URL } from '../../../lib/config'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()

  const res = await fetch(`${API_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const encoded = res.headers.get('x-chunks') ?? ''

  return new Response(res.body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'x-chunks': encoded,
    },
  })
}