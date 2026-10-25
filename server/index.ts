import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@as-integrations/express5'
import { Pool } from 'pg'
import { RELEASE_STEPS, toRelease } from './domain.js'

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/releases' })
const app = express()
const port = Number(process.env.PORT ?? 4000)

const typeDefs = `#graphql
  type Step { id: ID!, label: String!, completed: Boolean! }
  type Release { id: ID!, name: String!, date: String!, info: String!, status: String!, steps: [Step!]! }
  type Query { releases: [Release!]!, release(id: ID!): Release }
  type Mutation {
    createRelease(name: String!, date: String!, info: String): Release!
    updateReleaseInfo(id: ID!, info: String): Release!
    setStep(releaseId: ID!, stepId: ID!, completed: Boolean!): Release!
    deleteRelease(id: ID!): Boolean!
  }
`

type ReleaseRow = { id: string; name: string; release_date: Date; info: string | null; completed_steps: string[] }
const selectRelease = 'SELECT id, name, release_date, info, completed_steps FROM releases'
async function getRelease(id: string) {
    const result = await pool.query<ReleaseRow>(`${selectRelease} WHERE id = $1`, [id])
    return result.rows[0] ? toRelease(result.rows[0]) : null
}

const resolvers = {
    Query: {
        releases: async () => {
            const result = await pool.query<ReleaseRow>(`${selectRelease} ORDER BY release_date DESC, created_at DESC`)
            return result.rows.map(toRelease)
        },
        release: (_: unknown, { id }: { id: string }) => getRelease(id),
    },
    Mutation: {
        createRelease: async (_: unknown, { name, date, info }: { name: string; date: string; info?: string | null }) => {
            if (!name.trim()) throw new Error('Release name is required')
            const parsedDate = new Date(date)
            if (Number.isNaN(parsedDate.getTime())) throw new Error('Release date must be a valid datetime')
            const result = await pool.query<ReleaseRow>(
                'INSERT INTO releases (name, release_date, info) VALUES ($1, $2, $3) RETURNING id, name, release_date, info, completed_steps',
                [name.trim(), parsedDate, info?.trim() || null],
            )
            return toRelease(result.rows[0])
        },
        updateReleaseInfo: async (_: unknown, { id, info }: { id: string; info?: string | null }) => {
            const result = await pool.query('UPDATE releases SET info = $2, updated_at = now() WHERE id = $1 RETURNING id', [id, info?.trim() || null])
            if (!result.rowCount) throw new Error('Release not found')
            return getRelease(id)
        },
        setStep: async (_: unknown, { releaseId, stepId, completed }: { releaseId: string; stepId: string; completed: boolean }) => {
            if (!RELEASE_STEPS.some((step) => step.id === stepId)) throw new Error('Unknown release step')
            const result = await pool.query(
                `UPDATE releases SET completed_steps = CASE WHEN $3 THEN array_append(array_remove(completed_steps, $2), $2) ELSE array_remove(completed_steps, $2) END, updated_at = now() WHERE id = $1 RETURNING id`,
                [releaseId, stepId, completed],
            )
            if (!result.rowCount) throw new Error('Release not found')
            return getRelease(releaseId)
        },
        deleteRelease: async (_: unknown, { id }: { id: string }) => {
            const result = await pool.query('DELETE FROM releases WHERE id = $1', [id])
            return Boolean(result.rowCount)
        },
    },
}

const server = new ApolloServer({ typeDefs, resolvers })
await server.start()
await pool.query(`
  CREATE TABLE IF NOT EXISTS releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    release_date TIMESTAMPTZ NOT NULL,
    info TEXT,
    completed_steps TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`)

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true }))
app.get('/health', async (_request, response) => {
    try {
        await pool.query('SELECT 1')
        response.json({ status: 'ok' })
    } catch {
        response.status(503).json({ status: 'unavailable' })
    }
})
app.use('/graphql', express.json(), expressMiddleware(server))
app.use(express.static('dist'))
app.get(/.*/, (_request, response) => response.sendFile('index.html', { root: 'dist' }))

app.listen(port, () => console.log(`Release API listening on http://localhost:${port}`))
