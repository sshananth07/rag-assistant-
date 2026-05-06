import { NextRequest } from 'next/server'
import { API_URL } from '../../../../../lib/config'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const body = await req.json()
    const res = await fetch(`${API_URL}/sessions/${id}/name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    const data = await res.json()
    return Response.json(data)
}