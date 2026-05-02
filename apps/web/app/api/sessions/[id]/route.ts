import { API_URL } from '../../../../lib/config'
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const res = await fetch(`${API_URL}/sessions/${id}`)
    const data = await res.json()
    return Response.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    await fetch(`${API_URL}/sessions/${id}`, { method: 'DELETE' })
    return Response.json({ status: 'deleted' })
}