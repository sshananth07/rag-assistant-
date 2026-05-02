export async function GET() {
    const res = await fetch('http://localhost:3001/notes/export')
    const buffer = await res.arrayBuffer()
    return new Response(buffer, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': 'attachment; filename="research-notes.docx"',
        },
    })
}