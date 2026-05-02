import { API_URL } from '../../../../lib/config'
export async function GET() {
    const res = await fetch(`${API_URL}/notes/export`, {
        method: 'POST',
    })
    const buffer = await res.arrayBuffer()
    return new Response(buffer, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': 'attachment; filename="research-notes.docx"',
        },
    })
}