import type { VercelRequest, VercelResponse } from '@vercel/node'
import { graphqlServer, initializeApi } from '../server/graphql.js'

type GraphQLPayload = {
    query?: string
    variables?: Record<string, unknown>
    operationName?: string
}

function parseVariables(value: unknown) {
    if (typeof value !== 'string') return value as Record<string, unknown> | undefined
    try {
        return JSON.parse(value) as Record<string, unknown>
    } catch {
        return undefined
    }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (request.method !== 'POST' && request.method !== 'GET') {
        response.setHeader('Allow', 'GET, POST')
        return response.status(405).json({ errors: [{ message: 'Method not allowed' }] })
    }

    let payload: GraphQLPayload
    if (request.method === 'GET') {
        const query = request.query.query
        const variables = request.query.variables
        const operationName = request.query.operationName
        payload = {
            query: Array.isArray(query) ? query[0] : query,
            variables: parseVariables(Array.isArray(variables) ? variables[0] : variables),
            operationName: Array.isArray(operationName) ? operationName[0] : operationName,
        }
    } else {
        const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body
        payload = body && typeof body === 'object' ? body as GraphQLPayload : {}
    }

    if (!payload.query) {
        return response.status(400).json({ errors: [{ message: 'A GraphQL query is required' }] })
    }

    try {
        await initializeApi()
        const result = await graphqlServer.executeOperation({
            query: payload.query,
            variables: payload.variables,
            operationName: payload.operationName,
        })
        if (result.body.kind !== 'single') {
            return response.status(406).json({ errors: [{ message: 'Incremental responses are not supported' }] })
        }
        for (const [name, value] of result.http.headers) response.setHeader(name, value)
        return response.status(result.http.status ?? 200).json(result.body.singleResult)
    } catch (error) {
        console.error('GraphQL request failed', error)
        const message = process.env.VERCEL && !process.env.DATABASE_URL?.trim()
            ? 'DATABASE_URL is missing. Add the Neon connection string in Vercel project settings.'
            : 'Database connection failed. Check DATABASE_URL in Vercel project settings.'
        return response.status(503).json({ errors: [{ message }] })
    }
}