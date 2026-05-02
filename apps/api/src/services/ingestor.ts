import { extractText } from 'unpdf'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { QdrantClient } from '@qdrant/js-client-rest'
import { computeSparseVector } from './sparse.js'
import { db } from '../db/index.js'
import { papers } from '../db/schema.js'

const qdrant = new QdrantClient({ url: process.env.QDRANT_URL ?? 'http://localhost:6333' })
const COLLECTION = 'papers'
const EMBED_MODEL = 'nomic-embed-text'
const VECTOR_SIZE = 768

async function ensureCollection() {
  const collections = await qdrant.getCollections()
  const exists = collections.collections.some(c => c.name === COLLECTION)
  if (!exists) {
    await qdrant.createCollection(COLLECTION, {
      vectors: {
        dense: { size: VECTOR_SIZE, distance: 'Cosine' },
      },
      sparse_vectors: {
        sparse: { modifier: 'idf' },
      },
    })
  }
}

async function embedText(text: string): Promise<number[]> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Empty text passed to embedText')

  const res = await fetch(`${process.env.OLLAMA_URL ?? 'http://localhost:11434'}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: trimmed }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Ollama error: ${res.status} — ${body}`)
  }

  const json = await res.json()

  if (!json.embedding) {
    console.error('Bad Ollama response:', JSON.stringify(json))
    throw new Error(`Ollama returned no embedding: ${JSON.stringify(json)}`)
  }

  return json.embedding
}

function cleanText(raw: string): string {
  return raw
    .replace(/\f/g, '\n')                          // form feeds to newlines
    .replace(/[ \t]+/g, ' ')                       // collapse horizontal whitespace
    .replace(/^\s*\d+\s*$/gm, '')                  // remove lone page numbers
    .replace(/(\n\s*){3,}/g, '\n\n')               // collapse 3+ blank lines to 2
    .trim()
}

function extractTitle(text: string, filename: string): string {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 10 && l.length < 200)
    .filter(l => !/^\d+$/.test(l))
    .filter(l => !/^(abstract|introduction|references|contents|table of)/i.test(l))
    .filter(l => !/doi:|http|www\./i.test(l))

  // Take the first meaningful line
  const candidate = lines[0]
  if (candidate && candidate.length > 15) return candidate

  // Fall back to cleaned filename
  return filename
    .replace(/\.[^.]+$/, '')          // remove extension
    .replace(/[_-]/g, ' ')            // replace underscores/hyphens
    .replace(/\s+/g, ' ')             // collapse spaces
    .trim()
}

function extractSections(text: string): { heading: string; content: string }[] {
  // Match common academic section patterns:
  // "1. Introduction", "2.1 Methodology", "ABSTRACT", "References" etc.
  const sectionRegex = /^(?:\d+\.?\d*\.?\s+)?([A-Z][A-Za-z\s]{2,50})$/gm
  const sections: { heading: string; startIndex: number }[] = []
  let match

  while ((match = sectionRegex.exec(text)) !== null) {
    sections.push({ heading: match[1].trim(), startIndex: match.index })
  }

  return sections.map((s, i) => ({
    heading: s.heading,
    content: text.slice(s.startIndex, sections[i + 1]?.startIndex ?? text.length),
  }))
}

function findSectionForChunk(chunkText: string, sections: { heading: string; content: string }[]): string {
  for (const section of sections) {
    if (section.content.includes(chunkText.slice(0, 100))) {
      return section.heading
    }
  }
  return 'General'
}

function estimatePage(chunkIndex: number, totalChunks: number, totalPages: number): number {
  return Math.ceil((chunkIndex / totalChunks) * totalPages) || 1
}

export async function ingestPaper(buffer: Buffer, filename: string) {
  const { text: rawText, totalPages } = await extractText(new Uint8Array(buffer), { mergePages: true })
  const text = cleanText(rawText)

  // Extract metadata
  const title = extractTitle(text, filename)
  const sections = extractSections(text)

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1024,
    chunkOverlap: 100,
    separators: ['\n\n\n', '\n\n', '\n', '. ', ' '],
  })

  const chunks = (await splitter.splitText(text)).filter(chunk => chunk.trim().length > 0)

  await ensureCollection()
  const paperId = crypto.randomUUID()
  const batchSize = 10

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)
    const embeddings = await Promise.all(batch.map(embedText))
    const sparseVectors = batch.map(chunkText => computeSparseVector(chunkText))

    await qdrant.upsert(COLLECTION, {
      points: batch.map((chunkText, j) => ({
        id: crypto.randomUUID(),
        vector: {
          dense: embeddings[j],
          sparse: sparseVectors[j],
        },
        payload: {
          text: chunkText,
          paperId,
          chunkIndex: i + j,
          filename,
          title,
          section: findSectionForChunk(chunkText, sections),
          pageEstimate: estimatePage(i + j, chunks.length, totalPages ?? 1),
        },
      })),
    })
  }

  await db.insert(papers).values({
    id: paperId,
    filename,
    title,
    chunkCount: chunks.length,
    createdAt: Date.now(),
  })

  return { paperId, chunkCount: chunks.length, status: 'ok', title }
}