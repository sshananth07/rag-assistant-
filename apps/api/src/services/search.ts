type OpenAlexWork = {
    title: string
    authorships: { author: { display_name: string } }[]
    publication_year: number
    abstract_inverted_index: Record<string, number[]> | null
    open_access: {
        is_oa: boolean
        oa_url: string | null
    }
    doi: string | null
}

export type PaperResult = {
    title: string
    authors: string[]
    year: number
    abstract: string
    isOpenAccess: boolean
    pdfUrl: string | null  // only set if it's a DIRECT pdf link, not a DOI
    doi: string | null
}

function invertedIndexToText(index: Record<string, number[]> | null): string {
    if (!index) return 'No abstract available'
    const words = Object.entries(index).flatMap(([word, positions]) =>
        positions.map(pos => ({ word, pos }))
    )
    words.sort((a, b) => a.pos - b.pos)
    return words.map(w => w.word).join(' ')
}

async function getDirectPdfUrl(doi: string | null): Promise<string | null> {
    if (!doi) return null

    const cleanDoi = doi.replace('https://doi.org/', '')

    try {
        const res = await fetch(
            `https://api.unpaywall.org/v2/${cleanDoi}?email=research@paperbuddy.app`,
            { headers: { 'User-Agent': 'PaperBuddy/1.0' } }
        )
        if (!res.ok) return null

        const data = await res.json()
        const bestLocation = data.best_oa_location

        if (bestLocation?.url_for_pdf) return bestLocation.url_for_pdf
        if (bestLocation?.url?.includes('.pdf')) return bestLocation.url

        return null
    } catch {
        return null
    }
}

export async function searchPapers(query: string, limit = 10): Promise<PaperResult[]> {
    const encoded = encodeURIComponent(query)
    const fields = 'title,authorships,publication_year,abstract_inverted_index,open_access,doi'
    const url = `https://api.openalex.org/works?search=${encoded}&per-page=${limit}&select=${fields}&mailto=research@paperbuddy.app`

    const res = await fetch(url, {
        headers: { 'User-Agent': 'PaperBuddy/1.0' },
    })

    if (!res.ok) throw new Error(`OpenAlex error: ${res.status}`)

    const data = await res.json()

    const results = await Promise.all(
        (data.results as OpenAlexWork[]).map(async work => {
            const oaUrl = work.open_access.oa_url
            const isDirectPdf = oaUrl?.includes('.pdf') || oaUrl?.includes('arxiv.org/pdf')

            let pdfUrl: string | null = isDirectPdf ? oaUrl : null

            // Try Unpaywall for DOI-based open access papers
            if (!pdfUrl && work.open_access.is_oa && work.doi) {
                pdfUrl = await getDirectPdfUrl(work.doi)
            }

            return {
                title: work.title,
                authors: work.authorships.map(a => a.author.display_name),
                year: work.publication_year,
                abstract: invertedIndexToText(work.abstract_inverted_index),
                isOpenAccess: work.open_access.is_oa,
                pdfUrl,
                doi: work.doi,
            }
        })
    )

    return results
}