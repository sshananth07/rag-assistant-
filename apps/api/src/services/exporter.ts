import {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    BorderStyle, AlignmentType,
} from 'docx'

type Chunk = {
    id: string
    text: string
    filename: string
    section: string
    pageEstimate: number
    score: number
}

type Note = {
    id: string
    question: string
    answer: string
    chunks: Chunk[]
    paperIds: string[]
    createdAt: number
}

export async function generateExport(notes: Note[]): Promise<Uint8Array> {
    const children: Paragraph[] = []

    // Title
    children.push(
        new Paragraph({
            text: 'Research Notes',
            heading: HeadingLevel.TITLE,
            spacing: { after: 400 },
        })
    )

    children.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: `Generated on ${new Date().toLocaleDateString()} · ${notes.length} note${notes.length !== 1 ? 's' : ''}`,
                    color: '888888',
                    size: 20,
                }),
            ],
            spacing: { after: 600 },
        })
    )

    notes.forEach((note, i) => {
        // Note number heading
        children.push(
            new Paragraph({
                text: `Note ${i + 1}`,
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
            })
        )

        // Question
        children.push(
            new Paragraph({
                children: [
                    new TextRun({ text: 'Question: ', bold: true, size: 22 }),
                    new TextRun({ text: note.question, size: 22 }),
                ],
                spacing: { after: 200 },
            })
        )

        // Answer
        children.push(
            new Paragraph({
                text: 'Answer',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 120 },
            })
        )

        // Strip citation tags from answer for clean text
        const cleanAnswer = note.answer.replace(/\[chunk-\d+(?:,\s*chunk-\d+)*\]/g, '').trim()
        children.push(
            new Paragraph({
                children: [new TextRun({ text: cleanAnswer, size: 22 })],
                spacing: { after: 200 },
            })
        )

        // Source chunks
        children.push(
            new Paragraph({
                text: 'Source Excerpts',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 120 },
            })
        )

        note.chunks.forEach((chunk, j) => {
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: `[${chunk.id}] `, bold: true, color: '7c6af7', size: 20 }),
                        new TextRun({ text: `${chunk.filename} · ~p.${chunk.pageEstimate} · ${chunk.section}`, color: '888888', size: 18 }),
                    ],
                    spacing: { before: 160, after: 80 },
                })
            )

            children.push(
                new Paragraph({
                    children: [new TextRun({ text: chunk.text, size: 20, italics: true, color: '444444' })],
                    indent: { left: 400 },
                    border: {
                        left: { style: BorderStyle.SINGLE, size: 4, color: '7c6af7' },
                    },
                    spacing: { after: 160 },
                })
            )
        })

        // Divider between notes
        if (i < notes.length - 1) {
            children.push(
                new Paragraph({
                    border: {
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'dddddd' },
                    },
                    spacing: { before: 400, after: 400 },
                    text: '',
                })
            )
        }
    })

    const doc = new Document({
        sections: [{ children }],
        styles: {
            default: {
                document: {
                    run: { font: 'Calibri', size: 22 },
                },
            },
        },
    })

    const buffer = await Packer.toBuffer(doc)
    return new Uint8Array(buffer)
}