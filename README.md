# Video Factory (مصنع الفيديو)

**Arabic-first AI-powered video production platform connected to n8n orchestration.**

## Architecture Overview

```text
video-factory/
├── apps/
│   ├── web/              # Next.js 15+ App Router, Tailwind CSS, Arabic RTL-first Web App
│   └── render-worker/    # Remotion Rendering Engine boundary (Future Phases)
│
├── packages/
│   ├── contracts/        # Canonical Zod schemas, state machines, and typed payloads
│   ├── database/         # Drizzle ORM schemas, PostgreSQL migrations, queries & transactions
│   ├── providers/        # AI/Media provider extension interfaces
│   ├── ui/               # Shared design tokens & utilities (clsx, tailwind-merge)
│   └── config/           # Base TypeScript and tooling configurations
│
├── n8n/
│   ├── workflows/        # VF-00 Core Job Orchestrator workflow JSON
│   ├── schemas/          # JSON schemas for start & callback payloads
│   ├── examples/         # Sample request & callback payloads
│   └── README.md         # Full n8n setup and activation guide
│
├── infrastructure/
│   ├── docker/           # Docker Compose for local PostgreSQL
│   ├── nginx/            # Reverse proxy configuration
│   └── postgres/         # Database init scripts
│
├── docs/                 # Architectural and API specifications
├── STATUS.md             # Canonical project milestone tracking
└── .env.example          # Environment variables template
```

## Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Generate Database Schema / Migrations
```bash
pnpm db:generate
```

### 4. Run Automated Tests & Quality Gates
```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

### 5. Run Web Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) to access the Arabic web application.
