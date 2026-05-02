import { API_URL } from '../../../../../lib/config'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const body = await req.json()

    const res = await fetch(`${API_URL}/sessions/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })

    const data = await res.json()
    return Response.json(data)
}