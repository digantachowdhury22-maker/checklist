import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { expressMiddleware } from '@as-integrations/express5'
import { initializeApi, graphqlServer, pool } from './graphql.js'

const app = express()
const port = Number(process.env.PORT ?? 4000)
await initializeApi()

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true }))
app.get('/health', async (_request, response) => {
    try {
        await pool.query('SELECT 1')
        response.json({ status: 'ok' })
    } catch {
        response.status(503).json({ status: 'unavailable' })
    }
})
app.use('/graphql', express.json(), expressMiddleware(graphqlServer))
app.use(express.static('dist'))
app.get(/.*/, (_request, response) => response.sendFile('index.html', { root: 'dist' }))

app.listen(port, () => console.log(`Release API listening on http://localhost:${port}`))
