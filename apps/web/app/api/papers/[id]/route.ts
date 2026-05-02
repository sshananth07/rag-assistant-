import { API_URL } from '../../../../lib/config'
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const res = await fetch(`${API_URL}/papers/${id}`, { method: 'DELETE' })
    const data = await res.json()
    return Response.json(data)
}