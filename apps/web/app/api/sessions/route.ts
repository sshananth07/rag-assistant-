import { API_URL } from '../../../lib/config'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
    const page = req.nextUrl.searchParams.get('page') ?? '1'
    const limit = req.nextUrl.searchParams.get('limit') ?? '10'
    const res = await fetch(`${API_URL}/sessions?page=${page}&limit=${limit}`)
    const data = await res.json()
    return Response.json(data)
}

export async function POST() {
    const res = await fetch(`${API_URL}/sessions`, { method: 'POST' })
    const data = await res.json()
    return Response.json(data)
}