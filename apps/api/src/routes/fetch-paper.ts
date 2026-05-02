import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { ingestPaper } from '../services/ingestor.js'

export const fetchPaperRoute = new Hono()

const fetchSchema = z.object({
    pdfUrl: z.string().url(),
    title: z.string(),
})

async function fetchWithRedirects(url: string): Promise<Response> {
    let currentUrl = url
    let attempts = 0

    while (attempts < 5) {
        const res = await fetch(currentUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; PaperBuddy/1.0)',
                'Accept': 'application/pdf,*/*',
            },
            redirect: 'manual',
        })

        if (res.status >= 300 && res.status < 400) {
            const location = res.headers.get('location')
            if (!location) break
            currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).href
            attempts++
            continue
        }

        return res
    }

    throw new Error('Too many redirects or unresolvable URL')
}

fetchPaperRoute.post('/', zValidator('json', fetchSchema), async (c) => {
    const { pdfUrl, title } = c.req.valid('json')

    try {
        const res = await fetchWithRedirects(pdfUrl)

        if (!res.ok) {
            return c.json({ error: `Failed to download: ${res.status} ${res.statusText}` }, 400)
        }

        const contentType = res.headers.get('content-type') ?? ''
        if (!contentType.includes('pdf')) {
            return c.json({
                error: `URL returned ${contentType} instead of a PDF. This paper may require manual upload.`
            }, 400)
        }

        const arrayBuffer = await res.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const filename = `${title.slice(0, 60).replace(/[^a-z0-9]/gi, '_')}.pdf`

        const result = await ingestPaper(buffer, filename)
        return c.json(result)

    } catch (err: any) {
        console.error('Fetch paper error:', err.message)
        return c.json({ error: `Could not fetch paper: ${err.message}` }, 500)
    }
})