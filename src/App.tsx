import { useState } from 'react'
import { gql } from '@apollo/client'
import { useMutation, useQuery } from '@apollo/client/react'
import './App.css'

type Step = { id: string; label: string; completed: boolean }
type Release = { id: string; name: string; date: string; info: string; status: string; steps: Step[] }

const RELEASES = gql`query Releases { releases { id name date info status steps { id label completed } } }`
const CREATE_RELEASE = gql`mutation CreateRelease($name: String!, $date: String!, $info: String) { createRelease(name: $name, date: $date, info: $info) { id name date info status steps { id label completed } } }`
const UPDATE_INFO = gql`mutation UpdateInfo($id: ID!, $info: String) { updateReleaseInfo(id: $id, info: $info) { id info } }`
const TOGGLE_STEP = gql`mutation ToggleStep($releaseId: ID!, $stepId: ID!, $completed: Boolean!) { setStep(releaseId: $releaseId, stepId: $stepId, completed: $completed) { id status steps { id label completed } } }`
const DELETE_RELEASE = gql`mutation DeleteRelease($id: ID!) { deleteRelease(id: $id) }`

function App() {
    const { data, loading, error, refetch } = useQuery<{ releases: Release[] }>(RELEASES)
    const [createRelease] = useMutation<{ createRelease: Release }, { name: string; date: string; info?: string | null }>(CREATE_RELEASE)
    const [updateInfo] = useMutation(UPDATE_INFO)
    const [toggleStep] = useMutation(TOGGLE_STEP, { refetchQueries: [RELEASES] })
    const [deleteRelease] = useMutation(DELETE_RELEASE)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [name, setName] = useState('')
    const [date, setDate] = useState('')
    const [info, setInfo] = useState('')
    const [draftInfo, setDraftInfo] = useState<{ releaseId: string; value: string } | null>(null)

    const releases = data?.releases ?? []
    const selected = releases.find((release) => release.id === selectedId) ?? releases[0]
    const completedCount = selected?.steps.filter((step) => step.completed).length ?? 0
    const progress = selected?.steps.length ? Math.round((completedCount / selected.steps.length) * 100) : 0

    const currentInfo = selected && draftInfo?.releaseId === selected.id ? draftInfo.value : selected?.info ?? ''

    async function submitRelease(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const result = await createRelease({ variables: { name, date: new Date(date).toISOString(), info: info || null } })
        await refetch()
        setSelectedId(result.data?.createRelease.id ?? null)
        setName(''); setDate(''); setInfo(''); setShowForm(false)
    }

    async function saveInfo() {
        if (!selected) return
        await updateInfo({ variables: { id: selected.id, info: currentInfo || null } })
        await refetch()
        setDraftInfo(null)
    }

    async function removeRelease() {
        if (!selected || !window.confirm(`Delete “${selected.name}”?`)) return
        await deleteRelease({ variables: { id: selected.id } })
        setSelectedId(null)
        await refetch()
    }

    return (
        <main className="app-shell">
            <header className="topbar">
                <a className="brand" href="#home" aria-label="Shipshape home"><span className="brand-mark">S</span><span>shipshape</span></a>
                <div className="top-meta"><span className="connection-dot" /> Release operations <span className="meta-divider">/</span> Workspace</div>
                <div className="avatar" aria-label="Developer profile">D</div>
            </header>
            <div className="workspace">
                <aside className="sidebar">
                    <div className="side-label">WORKSPACE</div>
                    <button className="nav-item active"><span className="nav-icon">▦</span> Releases <span className="nav-count">{releases.length}</span></button>
                    <div className="side-footer"><span className="online-dot" /> All systems operational</div>
                </aside>
                <section className="main-content">
                    <div className="page-heading"><div><div className="eyebrow">SHIP WITH CONFIDENCE</div><h1>Release checklist</h1><p className="subheading">A clear path from ready to released.</p></div><button className="primary-button" onClick={() => setShowForm((open) => !open)}><span>＋</span> New release</button></div>
                    {showForm && <form className="create-form" onSubmit={submitRelease}><div className="form-heading"><strong>Plan a release</strong><button className="text-button" type="button" onClick={() => setShowForm(false)}>Cancel</button></div><div className="form-grid"><label>Release name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. v2.4.0" /></label><label>Release date<input type="datetime-local" required value={date} onChange={(event) => setDate(event.target.value)} /></label><label className="form-wide">Additional information <span className="optional">Optional</span><textarea value={info} onChange={(event) => setInfo(event.target.value)} placeholder="Scope, links, or notes for this release" rows={2} /></label></div><button className="primary-button" type="submit">Create release</button></form>}
                    {error && <div className="notice error">Could not reach the API. Start the backend and refresh to try again.</div>}
                    {loading ? <div className="empty-state">Loading release workspace...</div> : releases.length === 0 ? <div className="empty-state"><div className="empty-icon">↗</div><h2>Your next release starts here</h2><p>Create a release to track every step from planning to launch.</p><button className="primary-button" onClick={() => setShowForm(true)}>＋ Create your first release</button></div> : <div className="content-grid">
                        <section className="release-list"><div className="section-title"><h2>All releases</h2><span>{releases.length} total</span></div><div className="release-items">{releases.map((release) => <button key={release.id} className={`release-item ${selected?.id === release.id ? 'selected' : ''}`} onClick={() => setSelectedId(release.id)}><span className={`status-mark ${release.status}`} /><span className="release-copy"><strong>{release.name}</strong><small>{new Date(release.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</small></span><span className={`status-pill ${release.status}`}>{release.status}</span></button>)}</div></section>
                        {selected && <section className="detail-panel"><div className="detail-header"><div><div className="detail-kicker">RELEASE</div><h2>{selected.name}</h2><div className="detail-date">◷ &nbsp;{new Date(selected.date).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}</div></div><button className="icon-button danger" title="Delete release" aria-label="Delete release" onClick={removeRelease}>⌫</button></div>
                            <div className="progress-block"><div className="progress-label"><span>Release readiness</span><strong>{completedCount} <span>/ {selected.steps.length}</span></strong></div><div className="progress-track"><div className="progress-value" style={{ width: `${progress}%` }} /></div><div className="progress-foot"><span>{progress}% complete</span><span className={`status-pill ${selected.status}`}>{selected.status}</span></div></div>
                            <div className="checklist-heading"><h3>Release steps</h3><span>Changes save automatically</span></div><div className="steps">{selected.steps.map((step, index) => <label className={`step-row ${step.completed ? 'checked' : ''}`} key={step.id}><input type="checkbox" checked={step.completed} onChange={(event) => toggleStep({ variables: { releaseId: selected.id, stepId: step.id, completed: event.target.checked } })} /><span className="step-number">{String(index + 1).padStart(2, '0')}</span><span className="step-label">{step.label}</span>{step.completed && <span className="done-label">Done</span>}</label>)}</div>
                            <div className="info-section"><div className="info-heading"><h3>Additional information</h3><button className="save-button" onClick={saveInfo}>Save</button></div><textarea aria-label="Additional information" rows={3} value={currentInfo} onChange={(event) => setDraftInfo({ releaseId: selected.id, value: event.target.value })} placeholder="Add release notes, links, or context..." /></div>
                        </section>}
                    </div>}
                    <footer className="page-footer"><span>SHIPSHAPE <span className="footer-dot">·</span> RELEASE WORKSPACE</span><span>Built for the details that make shipping smooth.</span></footer>
                </section>
            </div>
        </main>
    )
}

export default App
