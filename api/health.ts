import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initializeApi, pool } from '../server/graphql.js'

export default async function handler(_request: VercelRequest, response: VercelResponse) {
    try {
        await initializeApi()
        await pool.query('SELECT 1')
        return response.status(200).json({ status: 'ok' })
    } catch {
        const error = process.env.VERCEL && !process.env.DATABASE_URL?.trim()
            ? 'DATABASE_URL is missing. Add the Neon connection string in Vercel project settings.'
            : 'Database connection failed. Check DATABASE_URL in Vercel project settings.'
        return response.status(503).json({ status: 'unavailable', error })
    }
}