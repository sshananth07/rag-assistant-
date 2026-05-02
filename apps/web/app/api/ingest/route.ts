import { API_URL } from '../../../lib/config'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const formData = await req.formData()

  const res = await fetch(`${API_URL}/ingest`, {
    method: 'POST',
    body: formData,
  })

  const data = await res.json()
  return Response.json(data)
}