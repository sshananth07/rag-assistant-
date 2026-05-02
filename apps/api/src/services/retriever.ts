import { QdrantClient } from '@qdrant/js-client-rest'
import { computeSparseVector } from './sparse.js'
import { rerankChunks } from './reranker.js'

const qdrant = new QdrantClient({ url: process.env.QDRANT_URL ?? 'http://localhost:6333' })
const COLLECTION = 'papers'
const EMBED_MODEL = 'nomic-embed-text'

async function embedQuery(text: string): Promise<number[]> {
    const res = await fetch(`${process.env.OLLAMA_URL ?? 'http://localhost:11434'}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: EMBED_MODEL, prompt: text.trim() }),
    })
    const json = await res.json()
    return json.embedding
}

function similarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/))
    const wordsB = new Set(b.toLowerCase().split(/\s+/))
    const intersection = [...wordsA].filter(w => wordsB.has(w)).length
    const union = new Set([...wordsA, ...wordsB]).size
    return intersection / union
}

function dedupChunks<T extends { text: string }>(chunks: T[], threshold = 0.8): T[] {
    const kept: T[] = []
    for (const chunk of chunks) {
        const isDuplicate = kept.some(k => similarity(k.text, chunk.text) > threshold)
        if (!isDuplicate) kept.push(chunk)
    }
    return kept
}

function orderChunks<T>(chunks: T[]): T[] {
    if (chunks.length <= 2) return chunks
    const result = new Array(chunks.length)
    let left = 0
    let right = chunks.length - 1
    for (let i = 0; i < chunks.length; i++) {
        if (i % 2 === 0) result[left++] = chunks[i]
        else result[right--] = chunks[i]
    }
    return result
}

export async function retrieveChunks(question: string, paperIds?: string[], topK = 5) {
    const [denseVector, sparseVector] = await Promise.all([
        embedQuery(question),
        Promise.resolve(computeSparseVector(question)),
    ])

    const filter = paperIds && paperIds.length > 0 ? {
        must: [{ key: 'paperId', match: { any: paperIds } }]
    } : undefined

    const results = await qdrant.query(COLLECTION, {
        prefetch: [
            {
                query: { indices: sparseVector.indices, values: sparseVector.values },
                using: 'sparse',
                limit: topK * 3,
                filter,
            },
            {
                query: denseVector,
                using: 'dense',
                limit: topK * 3,
                filter,
            },
        ],
        query: { fusion: 'rrf' },
        limit: topK * 3,
        with_payload: true,
    })

    const mapped = results.points.map((r, i) => ({
        id: `chunk-${i + 1}`,
        text: r.payload?.text as string,
        filename: r.payload?.filename as string,
        section: r.payload?.section as string ?? 'General',
        pageEstimate: r.payload?.pageEstimate as number ?? 1,
        title: r.payload?.title as string ?? '',
        score: r.score,
    }))

    const deduped = dedupChunks(mapped).slice(0, topK * 2)
    const ordered = orderChunks(deduped.slice(0, topK))
    return ordered.map((chunk, i) => ({ ...chunk, id: `chunk-${i + 1}` }))
}