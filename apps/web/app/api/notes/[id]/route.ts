import { API_URL } from '../../../../lib/config'
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    await fetch(`${API_URL}/notes/${id}`, { method: 'DELETE' })
    return Response.json({ status: 'deleted' })
}