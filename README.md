# Shipshape Release Checklist

A single-page release checklist for planning releases and tracking a fixed set of eight launch steps. The React client talks to a Node GraphQL API, and PostgreSQL stores release records and completed step IDs.

## Run locally

### Full application with Docker

Requirements: Docker Desktop with Compose enabled.

```sh
docker compose up --build
```

Open `http://localhost:4000`. GraphQL is available at `http://localhost:4000/graphql`; health is at `http://localhost:4000/health`. Stop with `Ctrl+C`. PostgreSQL data is retained in the `postgres_data` volume.

### Local frontend and API

Requirements: Node.js 22+, npm, Docker.

```sh
docker compose up -d db
npm ci
npm run dev:stack
```

Open `http://localhost:5173`. Vite proxies `/graphql` and `/health` to the API at port 4000. To stop PostgreSQL, run `docker compose down` (add `-v` only when you intentionally want to delete stored data).

The API accepts `PORT`, `DATABASE_URL`, and `CORS_ORIGIN`; see `.env.example`. The API creates the `releases` table on startup. A separate database migration framework is intentionally omitted for this small assessment.

## Commands

- `npm run build` builds the React SPA and typechecks the frontend.
- `npm test` runs the automated release-domain tests.
- `npm run typecheck:api` typechecks the API (also included in `npm run build`).
- `npm run stress` ramps through 1, 10, 25, 50, and 100 concurrent GraphQL query loops, running each level for 10 seconds by default. Configure with `CONCURRENCY=1,10,25,50,100`, `DURATION_SECONDS=10`, and `GRAPHQL_URL=http://localhost:4000/graphql`.
- `npm run lint` runs Oxlint.

## API

The API uses GraphQL over HTTP POST at `/graphql` (JSON request body with `query` and optional `variables`). The health endpoint is `GET /health`.

Queries:

- `releases: [Release!]!` lists releases, latest due date first.
- `release(id: ID!): Release` fetches one release.

Mutations:

- `createRelease(name: String!, date: String!, info: String): Release!`
- `updateReleaseInfo(id: ID!, info: String): Release!`
- `setStep(releaseId: ID!, stepId: ID!, completed: Boolean!): Release!`
- `deleteRelease(id: ID!): Boolean!`

A `Release` returns `id`, `name`, ISO-8601 `date`, `info`, computed `status`, and `steps`. Each step has `id`, `label`, and `completed`. The status is not user-editable or persisted: zero completed steps is `planned`, some completed is `ongoing`, and all eight completed is `done`.

## Database schema

```sql
CREATE TABLE releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  release_date TIMESTAMPTZ NOT NULL,
  info TEXT,
  completed_steps TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

The checklist definition is code-owned and shared by all releases, so a separate steps table is unnecessary. Each row stores only completed step IDs in a PostgreSQL text array. API validation rejects unknown step IDs, and status is derived from the code-owned eight-step list.

## Design decisions

- **Stack:** Vite + React + TypeScript builds the SPA. Apollo Client and Apollo Server provide the GraphQL API layer. Express is retained for the local Docker backend; Vercel hosts the built SPA and invokes Node functions for GraphQL and health checks.
- **Persistence:** PostgreSQL stores release metadata and the completed-step ID array. `TIMESTAMPTZ` preserves timezone-aware release dates; IDs are UUIDs.
- **Status:** Status is computed on the API from completed steps instead of accepting user input or storing a value that could become stale. The assessment mentions `auto` as a possible status, but its explicit status rules define only `planned`, `ongoing`, and `done`, so `auto` is not exposed as a separate state.
- **Checklist:** Eight fixed steps cover scope, code freeze, CI, security, staging, sign-off, production, and rollout monitoring. Keeping definitions in code avoids duplicated step records while satisfying the shared-checklist constraint.
- **UX:** One dashboard presents a selectable release list and its detail checklist. Completion is immediate; additional information is explicitly saved. Delete requires confirmation. Responsive styling moves the list above release details on mobile.
- **Local runtime:** Docker Compose runs the API/SPA and PostgreSQL together. The API creates its table on startup for this assessment-sized app. Use a formal migration tool, secrets manager, backups, and stricter CORS before production use.
- **Deployment:** Vercel serves the Vite output and runs the API as Node functions; Neon Free provides PostgreSQL. `vercel.json` rewrites `/graphql` and `/health` to the function handlers. The only required production secret is `DATABASE_URL`.

## Vercel deployment

This setup targets Vercel Hobby and Neon's Free PostgreSQL plan. Vercel Hobby is limited to personal, non-commercial projects; use this only if that matches your use case.

1. In Neon, create a project on the **Free** plan and copy the pooled connection string from the dashboard. Keep it private; it contains database credentials.
2. In Vercel, import `digantachowdhury22-maker/checklist` from GitHub. Keep the Vite framework preset, build command `npm run build`, and output directory `dist`.
3. Add `DATABASE_URL` in Vercel's project environment variables using the Neon pooled connection string. Do not add it to source control.
4. Deploy, then open the Vercel URL and verify `/health`, `/graphql`, and the UI. For local function emulation, install/use the Vercel CLI and run `vercel dev` after configuring `DATABASE_URL`.

Free-tier caveats checked against provider docs on 2026-10-25: Vercel Hobby usage is capped (including function invocations/compute and transfer) and is for personal, non-commercial use. Hobby usage limits pause features until the allowance resets. Neon Free currently includes up to 100 CU-hours/project/month, 1 GB storage/project, and 5 GB public egress/project/month; its database compute suspends after 5 idle minutes. Hitting Neon usage limits can suspend compute or block writes. There are no overages on Vercel Hobby, but check provider billing and usage dashboards and do not upgrade resources if you need to keep this at $0. Provider limits and billing rules can change.

## Stress-test notes

`npm run stress` is a local GraphQL read ramp, not a cloud capacity guarantee. It reports successful requests per second, failures/drops, and p50/p95/p99 latency. Results depend on machine, Docker resource limits, database plan, network, and competing workloads.

### Local run (2026-10-25)

Measured on Docker Desktop 4.96.3 / Docker Engine 29.9.2, using the `node:22-alpine` app and `postgres:16-alpine` containers on a Windows 10 Home host. Docker reported a 7.603 GiB container memory limit; at idle after the test, the app used about 311 MiB and PostgreSQL about 36 MiB. Each level ran for 10 seconds against `query { releases { id status } }`; the database contained no releases. “Concurrency” is the number of request-loop workers, not a count of real human users.

| Workers | Successful req/s | Failures / dropped | p95 latency | p99 latency |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 69.1 | 0 / 691 | 17.1 ms | 18.3 ms |
| 10 | 2,005.6 | 0 / 20,056 | 8.4 ms | 12.7 ms |
| 25 | 2,408.0 | 0 / 24,080 | 14.2 ms | 18.5 ms |
| 50 | 2,547.1 | 0 / 25,471 | 24.5 ms | 29.0 ms |
| 100 | 2,500.2 | 0 / 25,002 | 46.7 ms | 52.4 ms |
| 200 | 2,098.3 | 0 / 20,983 | 109.3 ms | 219.5 ms |
| 400 | 2,240.8 | 0 / 22,408 | 192.7 ms | 473.7 ms |
| 800 | 2,130.1 | 0 / 21,301 | 433.3 ms | 2,152 ms |
| 1,200 | 911.3 | 1,316 / 10,429 | 4,311 ms | 4,555 ms |
| 1,600 | 2,126.0 | 912 / 22,172 | 878 ms | 1,316 ms |

No drops occurred through 800 workers; drops first appeared at 1,200 workers, where 1,316 of 10,429 requests failed. The 1,600-worker run had fewer drops proportionally, so this is a noisy overload signal, not a stable monotonic capacity threshold. Latency was already substantially degraded at 800 workers. Treat this only as a local test observation, not a claim about simultaneous users or hosted capacity. Repeat with a controlled load-testing tool and the deployed service for an assessment-grade capacity result.

The assessment asks for a comparison to an “initial LLM implementation.” This project contains no LLM-based implementation or baseline, so there is no valid LLM-versus-optimized delta to claim. The stress results above measure only the current deterministic GraphQL API. Recording the required face-and-voice demo still requires the assessment owner as presenter.
