This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### ExpoPrint local dev

From the project root, start the app with dependencies checked automatically:

```bash
npm run dev:local
```

The dev server runs at **http://localhost:3000**.

### Environment variables

Future Claude / Anthropic calls will read configuration from the environment. The app stays fully usable without any API key; mock “Analyze Website” behavior is unchanged until real integration is added.

1. Copy `.env.example` to `.env.local` for local development.
2. Set `ANTHROPIC_API_KEY` in `.env.local` when you are ready to wire up the API (get a key from the Anthropic console).
3. Never commit `.env.local` or any file that contains real secrets (they are listed in `.gitignore`).
4. On Railway, add `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`) in the project **Variables** tab instead of putting keys in the repo.

### Project progress and work log

- **Roadmap / stages:** [http://localhost:3000/progress](http://localhost:3000/progress) (when the dev server is running).
- **Clockify-style notes:** see [`docs/work-log.md`](docs/work-log.md).

Alternatively, run the development server directly:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
