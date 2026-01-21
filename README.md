# Immigration AI

A modern, AI-powered immigration case management platform for attorneys that provides secure document management, intelligent document processing, and automated form filling.

## Features

- **Secure Document Vault**: Bank-level encryption with multi-factor authentication
- **AI Document Analysis**: Automatically extract data from passports, I-94s, and more
- **Smart Form Auto-Fill**: Pre-populate USCIS forms with extracted data
- **Case Management**: Track cases, deadlines, and document requirements
- **Attorney Review Workflow**: Review AI suggestions with confidence scores
- **Client Portal**: Secure access for clients to upload documents and track progress

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth with MFA support
- **AI/ML**: OpenAI GPT-4 Vision / Claude API
- **Storage**: Supabase Storage (encrypted at rest)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/immigration-ai.git
cd immigration-ai
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment variables:
```bash
cp .env.example .env.local
```

4. Update `.env.local` with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

5. Run the database migrations in Supabase SQL editor (files in `supabase/migrations/`)

6. Start the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
immigration-ai/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/            # Authentication pages
│   │   ├── dashboard/         # Protected dashboard routes
│   │   └── api/               # API routes
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   ├── layout/            # Layout components
│   │   └── ...                # Feature components
│   ├── lib/
│   │   ├── supabase/          # Supabase client utilities
│   │   ├── ai/                # AI integration
│   │   └── utils/             # General utilities
│   ├── hooks/                 # Custom React hooks
│   └── types/                 # TypeScript types
├── supabase/
│   └── migrations/            # Database migrations
└── public/                    # Static assets
```

## Supported Visa Types

- Family-based: I-130, I-485, I-765, I-131
- Employment-based: H1B, H4, L1, O1, EB1, EB2, EB3, EB5
- Naturalization: N-400
- And more...

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Type check
npm run type-check
```

## Security

- All documents encrypted at rest (AES-256)
- TLS 1.3 for data in transit
- Row-level security in PostgreSQL
- Multi-factor authentication support
- Audit logging for all document access

## Deploy on Vercel

The easiest way to deploy this app is using the [Vercel Platform](https://vercel.com/new):

1. Push your code to GitHub
2. Import the repository in Vercel
3. Add your environment variables
4. Deploy!

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a pull request.
