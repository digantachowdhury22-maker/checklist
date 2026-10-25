import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initializeApi, pool } from '../server/graphql.js'

export default async function handler(_request: VercelRequest, response: VercelResponse) {
    try {
        await initializeApi()
        await pool.query('SELECT 1')
        return response.status(200).json({ status: 'ok' })
    } catch {
        return response.status(503).json({ status: 'unavailable' })
    }
}