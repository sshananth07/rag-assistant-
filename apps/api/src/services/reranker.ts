import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY ?? '')
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

type Chunk = {
    id: string
    text: string
    filename: string
    section: string
    pageEstimate: number
    title: string
    score: number
}

export async function rerankChunks(question: string, chunks: Chunk[], topK = 5): Promise<Chunk[]> {
    if (chunks.length <= topK) return chunks

    const prompt = `You are a relevance scoring system. Given a question and a list of text excerpts, score each excerpt's relevance to the question from 0.0 to 1.0.

Question: ${question}

Rate each excerpt and respond ONLY with a JSON array of scores in the same order as the excerpts. Example: [0.9, 0.2, 0.8, 0.1, 0.7]

Excerpts:
${chunks.map((c, i) => `[${i}] ${c.text.slice(0, 300)}`).join('\n\n')}

Respond with ONLY the JSON array, nothing else.`

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const result = await model.generateContent(prompt)
            const raw = result.response.text().trim()
            const cleaned = raw.replace(/```json|```/g, '').trim()
            const scores: number[] = JSON.parse(cleaned)

            return chunks
                .map((chunk, i) => ({ ...chunk, score: scores[i] ?? 0 }))
                .sort((a, b) => b.score - a.score)
                .slice(0, topK)

        } catch (err: any) {
            const is429 = err?.status === 429
            const isLast = attempt === 3

            if (is429 && !isLast) {
                const retryDelay = err?.errorDetails?.find((d: any) => d.retryDelay)?.retryDelay
                const seconds = retryDelay ? parseInt(retryDelay) : 60
                console.log(`Reranker rate limited — waiting ${seconds}s before retry ${attempt}/3...`)
                await new Promise(r => setTimeout(r, seconds * 1000))
            } else {
                console.error('Reranker failed, falling back to original order:', err)
                return chunks.slice(0, topK)
            }
        }
    }

    return chunks.slice(0, topK)
}