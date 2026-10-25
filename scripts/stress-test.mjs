const endpoint = process.env.GRAPHQL_URL ?? 'http://localhost:4000/graphql'
const durationSeconds = Number(process.env.DURATION_SECONDS ?? 10)
const levels = (process.env.CONCURRENCY ?? '1,10,25,50,100').split(',').map(Number)
const query = '{ releases { id status } }'

async function runLevel(concurrency) {
    const deadline = Date.now() + durationSeconds * 1000
    const durations = []
    let successes = 0
    let failures = 0
    let dropped = 0
    async function worker() {
        while (Date.now() < deadline) {
            const started = performance.now()
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ query }),
                    signal: AbortSignal.timeout(5000),
                })
                const body = await response.json()
                durations.push(performance.now() - started)
                if (!response.ok || body.errors) failures++
                else successes++
            } catch {
                failures++
                dropped++
            }
        }
    }
    await Promise.all(Array.from({ length: concurrency }, () => worker()))
    durations.sort((a, b) => a - b)
    const percentile = (p) => durations[Math.min(Math.ceil(durations.length * p) - 1, durations.length - 1)] ?? 0
    console.log(JSON.stringify({
        concurrency,
        durationSeconds,
        requests: successes + failures,
        successes,
        failures,
        dropped,
        requestsPerSecond: Number((successes / durationSeconds).toFixed(1)),
        p50Ms: Number(percentile(0.5).toFixed(1)),
        p95Ms: Number(percentile(0.95).toFixed(1)),
        p99Ms: Number(percentile(0.99).toFixed(1)),
    }))
}

for (const level of levels) await runLevel(level)
