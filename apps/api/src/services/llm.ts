import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY ?? '')
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function* streamWithRetry(prompt: string, retries = 3): AsyncGenerator<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContentStream(prompt)
      for await (const chunk of result.stream) {
        yield chunk.text()
      }
      return
    } catch (err: any) {
      const is429 = err?.status === 429
      const isLast = attempt === retries

      if (is429 && !isLast) {
        const retryDelay = err?.errorDetails?.find((d: any) => d.retryDelay)?.retryDelay
        const seconds = retryDelay ? parseInt(retryDelay) : 60
        console.log(`Rate limited — waiting ${seconds}s before retry ${attempt}/${retries}...`)
        await wait(seconds * 1000)
      } else {
        throw err
      }
    }
  }
}

export async function* askGemini(
  question: string,
  chunks: { id: string; text: string; filename: string }[],
  socraticMode = false
) {
  const context = chunks
    .map(c => `[${c.id}] (from: ${c.filename})\n${c.text}`)
    .join('\n\n---\n\n')

  const basePrompt = `You are a research assistant. Answer the question using ONLY the provided excerpts.
For every claim you make, cite the single most relevant chunk ID inline like [chunk-2].
Only cite a chunk if it directly supports the claim. Never cite more than 2 chunks per sentence.
If the answer cannot be found in the excerpts, say so clearly.

EXCERPTS:
${context}

QUESTION: ${question}`

  const socraticSuffix = `

After your answer, add a section titled "Questions to strengthen your writing:" and provide 3-4 targeted Socratic questions that would help the user write a stronger paragraph about this topic. Questions should:
- Point to specific gaps or unsupported claims in the answer
- Reference specific chunks by ID when relevant
- Push the user to think about context, methodology, or limitations
- Never write content for the user — only ask questions`

  const prompt = socraticMode ? basePrompt + socraticSuffix : basePrompt

  yield* streamWithRetry(prompt)
}