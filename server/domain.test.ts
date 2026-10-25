import { describe, expect, it } from 'vitest'
import { getReleaseStatus, RELEASE_STEPS, toRelease } from './domain.js'

describe('release status', () => {
    it('is planned with no completed steps and ongoing with partial completion', () => {
        expect(getReleaseStatus([])).toBe('planned')
        expect(getReleaseStatus([RELEASE_STEPS[0].id])).toBe('ongoing')
    })

    it('is done only when every defined step is complete', () => {
        const allIds = RELEASE_STEPS.map((step) => step.id)
        expect(getReleaseStatus(allIds)).toBe('done')
        expect(getReleaseStatus(allIds.slice(1))).toBe('ongoing')
    })
})

describe('release mapping', () => {
    it('maps stored IDs to a fixed checklist and normalizes empty information', () => {
        const release = toRelease({
            id: 'release-id',
            name: 'v1.0.0',
            release_date: '2026-10-25T09:00:00.000Z',
            info: null,
            completed_steps: [RELEASE_STEPS[0].id],
        })
        expect(release.info).toBe('')
        expect(release.status).toBe('ongoing')
        expect(release.steps).toHaveLength(8)
        expect(release.steps[0].completed).toBe(true)
        expect(release.steps[1].completed).toBe(false)
    })
})
