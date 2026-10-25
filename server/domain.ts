export const RELEASE_STEPS = [
    { id: 'scope', label: 'Confirm release scope and changelog' },
    { id: 'code-freeze', label: 'Merge approved changes and freeze code' },
    { id: 'ci', label: 'Pass CI, unit, and integration checks' },
    { id: 'security', label: 'Complete security and dependency review' },
    { id: 'staging', label: 'Deploy to staging and run smoke tests' },
    { id: 'sign-off', label: 'Get product and engineering sign-off' },
    { id: 'production', label: 'Deploy to production' },
    { id: 'monitor', label: 'Verify health and monitor the rollout' },
] as const

export type ReleaseStatus = 'planned' | 'ongoing' | 'done'

export function getReleaseStatus(completedStepIds: readonly string[]): ReleaseStatus {
    if (completedStepIds.length === 0) return 'planned'
    if (RELEASE_STEPS.every((step) => completedStepIds.includes(step.id))) return 'done'
    return 'ongoing'
}

export function toRelease(row: {
    id: string
    name: string
    release_date: Date | string
    info: string | null
    completed_steps: string[]
}) {
    const completed = new Set(row.completed_steps)
    return {
        id: row.id,
        name: row.name,
        date: new Date(row.release_date).toISOString(),
        info: row.info ?? '',
        status: getReleaseStatus(row.completed_steps),
        steps: RELEASE_STEPS.map((step) => ({ ...step, completed: completed.has(step.id) })),
    }
}
