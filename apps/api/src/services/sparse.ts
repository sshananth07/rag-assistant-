export function computeSparseVector(text: string): { indices: number[]; values: number[] } {
    const words = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2)

    const termFreq: Record<string, number> = {}
    for (const word of words) {
        termFreq[word] = (termFreq[word] ?? 0) + 1
    }

    // Accumulate by index to handle hash collisions
    const indexMap: Record<number, number> = {}

    for (const [term, freq] of Object.entries(termFreq)) {
        let hash = 0
        for (let i = 0; i < term.length; i++) {
            hash = (hash * 31 + term.charCodeAt(i)) & 0xffff
        }
        const tf = freq / words.length
        const idf = Math.log(1 + 1 / (freq + 1))
        const score = parseFloat((tf * idf).toFixed(6))

        // If collision, sum the values
        indexMap[hash] = parseFloat(((indexMap[hash] ?? 0) + score).toFixed(6))
    }

    const indices = Object.keys(indexMap).map(Number)
    const values = indices.map(i => indexMap[i])

    return { indices, values }
}
