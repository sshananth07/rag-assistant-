import { API_URL } from '../../../lib/config'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
    const body = await req.json()
    const res = await fetch(`${API_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    const data = await res.json()
    return Response.json(data)
}