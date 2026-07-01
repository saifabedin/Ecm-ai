# ECM AI OS

Multi-tenant AI SaaS platform for marketing automation, content generation, and business intelligence.

## Architecture

```
Frontend (React/Vite) → API (Express) → Orchestrator → BullMQ Queue → Worker → AI Engines → Database
```

## Tech Stack

- **Backend:** Node.js, Express, BullMQ, Redis
- **Database:** PostgreSQL (Neon)
- **Frontend:** React, Vite, Tailwind CSS
- **AI Engines:** OpenAI, Anthropic, Replicate, ElevenLabs, D-ID, Pexels
- **Runtime:** PM2

## Features

- Multi-tenant architecture with brand isolation
- 9 AI engines (Research, Content, Image, Video, Publish, Ads, Tracking, Optimization, Delayed Jobs)
- Real-time job queue processing
- Authentication & authorization
- Billing & subscription management
- Campaign management
- Knowledge graph & galaxy

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Run migrations
npm run migrate

# Seed database
npm run seed

# Start development server
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start development server with nodemon |
| `npm run migrate` | Run database migrations |
| `npm run seed` | Seed database with initial data |

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key

# AI Services
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
REPLICATE_API_TOKEN=r8_...
ELEVENLABS_API_KEY=...
```

## Project Structure

```
ecm-ai-os/
├── backend/
│   ├── ai/              # AI service integrations
│   ├── agents/          # Agent system
│   ├── controllers/     # Route handlers
│   ├── db/              # Database migrations & queries
│   ├── engines/         # AI engines (1-9)
│   ├── middleware/       # Auth, validation, etc.
│   ├── queues/          # BullMQ job queues
│   ├── routes/          # API routes
│   └── services/        # Business logic
├── frontend/
│   └── src/
│       ├── components/  # React components
│       ├── context/     # React context
│       └── utils/       # Utility functions
└── ecosystem.config.js  # PM2 configuration
```

## License

Private - All rights reserved.
