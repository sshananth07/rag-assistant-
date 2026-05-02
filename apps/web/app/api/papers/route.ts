import { API_URL } from '../../../lib/config'
export async function GET() {
    const res = await fetch(`${API_URL}/papers`)
    const data = await res.json()
    return Response.json(data)
}