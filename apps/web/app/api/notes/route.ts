import { API_URL } from '../../../lib/config'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
    const sessionId = req.nextUrl.searchParams.get('sessionId')
    const page = req.nextUrl.searchParams.get('page') ?? '1'
    const limit = req.nextUrl.searchParams.get('limit') ?? '10'

    let url = `${API_URL}/notes?page=${page}&limit=${limit}`
    if (sessionId) url += `&sessionId=${sessionId}`

    const res = await fetch(url)
    const data = await res.json()
    return Response.json(data)
}

export async function POST(req: NextRequest) {
    const body = await req.json()
    const res = await fetch(`${API_URL}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    const data = await res.json()
    return Response.json(data)
}