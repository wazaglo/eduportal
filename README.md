# eduportal-azubi-success

AI-powered student support platform. Students ask academic questions and get answers grounded in the NaCCA Senior High School curriculum knowledge base.

Serverless on AWS; the frontend is a Qwik City SPA.

## Branch Strategy

Work on **`dev`**; `main` is protected and requires pull request reviews.

## Quick Start

Docker:

```bash
docker compose -f docker/docker-compose.yml up frontend
```

Open **http://localhost:8081**.

No Docker:

```bash
cd frontend && npm install && npm run dev -- --port 8081
```

## Project Structure

```
frontend/    Qwik City SPA (UI, stores, API wiring)
backend/     AWS Lambda handlers (serverless)
infra/       DynamoDB + Bedrock KB infrastructure templates
docker/      Docker Compose for local dev
docs/        Architecture, API, deployment, and Bedrock KB docs
.github/     CI/CD workflows
amplify.yml  Amplify hosting config for the frontend
```

## Architecture

- **API**: API Gateway (REST). A **Cognito user pool authorizer** protects every route except `/auth/*` and `OPTIONS`. Clients send the Cognito **ID token** as `Authorization: Bearer <idToken>`.
- **Auth**: Cognito owns user accounts; each Lambda resolves the user's role (`student`, `admin`, `support`) from the `ai-student-users` table via the `sub` claim. Admin endpoints additionally require the `admin` role.
- **Compute**: 24 Lambda handlers (`nodejs20.x`); `question/ask` is 120s / 1024MB, `knowledge-base/*` sync is 30s / 256MB, the rest 30s / 256MB.
- **Data**: DynamoDB (on-demand tables), S3 knowledge base.
- **AI**: Amazon Bedrock — a **Bedrock Knowledge Base** (S3 Vectors) does semantic retrieval over the curriculum, and Amazon **Nova** models generate answers with **Bedrock Guardrails** for content filtering (see [AI Integration](#ai-integration)). No external API keys:
- **Monitoring**: CloudWatch access/execution logging, alarms → SNS, `eduportal-monitoring` dashboard.

Details: [docs/architecture.md](docs/architecture.md), [docs/aws-resources.md](docs/aws-resources.md), [docs/bedrock-knowledge-base.md](docs/bedrock-knowledge-base.md).

## Lambda Backend

24 TypeScript handlers in `backend/src/functions/`, deployed to Lambda as `eduportal-<name>`.

Scripts (in `backend/`):

```bash
npm run build      # bundle handlers with esbuild into dist/
npm run package    # zip each handler into deployments/
npm test           # vitest unit tests (35, no AWS SDK mocks)
npm run typecheck  # tsc --noEmit
```

## Knowledge Base

NaCCA Senior High School curriculum PDFs are parsed into searchable text sections in S3 (`knowledge/{Subject}/{Strand}/{Subject}-SHS{n}-{...}.txt`; 108 documents + 4 source PDFs). Subjects: Core Mathematics, English Language, Integrated Science, Social Studies. Metadata lives in the `ai-student-knowledge` table.

The curriculum is indexed into a **Bedrock Knowledge Base** (`SSJQQYPJ4A`) on an **S3 Vectors** store with Titan V2 embeddings, enabling **semantic search**. New documents are uploaded via the presigned upload flow (`POST /knowledge-base/presign-upload` → `POST /knowledge-base/complete-upload`), which **auto-triggers a KB ingestion re-sync** so the upload becomes searchable immediately. An admin can also force a re-sync at any time via the `eduportal-knowledge-base-sync-knowledge-base` Lambda (admin-only). The full provisioning runbook is in [docs/bedrock-knowledge-base.md](docs/bedrock-knowledge-base.md).

## API

Core flow: `POST /ask` searches the Bedrock knowledge base (semantic) and falls back to the AI model; `GET /question`, `GET /FAQ`, and `DELETE /question/{id}` manage questions. Auth endpoints live under `/auth/*`, profile under `/user/profile`, feedback under `/feedback`, knowledge-base and admin under `/knowledge-base/*` and `/admin/*`.

Full endpoint reference (methods, request/response, lambdas): [docs/api.md](docs/api.md).

## AI Integration

When the knowledge base cannot answer confidently, the backend falls back to an Amazon **Nova** model for a clean, grounded answer. `ProviderFactory` returns a single `BedrockProvider`:

- **Routine** questions → **Nova Lite** (`eu.amazon.nova-lite-v1:0`)
- **Complex** questions → **Nova Pro** (`eu.amazon.nova-pro-v1:0`)

Bedrock is invoked over the **InvokeModel API** using the Lambda role's IAM credentials (no API key), with **Bedrock Guardrails** (`eduportalGuardrail`, ID `8tznv6byph2i`) applied for content filtering and PII protection — blocked responses return a user-friendly message. Each answered question records `modelUsed` and logs `ai_response` analytics events surfaced in the admin analytics report.

**Why `eu.` prefix?** On-demand Nova calls require the regional **inference-profile** ID, not the bare model ID (`amazon.nova-pro-v1:0` fails).

**Rate limiting:** each user is capped at **10 AI answers per day** (configurable via the `AI_DAILY_LIMIT` env var, default `10`). Knowledge-base answers are unlimited and don't count toward the cap; the excess AI answer returns HTTP `429` with a friendly frontend message.

### Enable/configure (console)
1. **Bedrock** → Model access → enable Nova Lite/Pro in eu-west-1 (see [docs/bedrock-knowledge-base.md](docs/bedrock-knowledge-base.md) for the full setup).
2. **IAM** → role `eduportal-lambda-role` → attach the inline policy giving `bedrock:InvokeModel` (and `bedrock:Retrieve` on the KB).
3. Set the Bedrock values as GitHub secrets (see [docs/deployment.md](docs/deployment.md)): `BEDROCK_MODEL_ID`, `BEDROCK_MODEL_ROUTINE`, `BEDROCK_MODEL_COMPLEX`, `BEDROCK_KNOWLEDGE_BASE_ID`, `BEDROCK_GUARDRAIL_ID`.

## CI/CD

GitHub Actions:
- **Deploy Backend** — runs on push to `dev`/`main` for `backend/**` (or `workflow_dispatch`): lint-and-test → deploy via OIDC (assumes `eduportal-github-actions-oidc`), updates the 24 `eduportal-*` Lambdas. Triggered by any code change.
- **Deploy Infra (Bedrock)** — runs on push for `infra/**` (or `workflow_dispatch`): deploys the `eduportal-bedrock` CloudFormation stack (`infra/cloudformation/bedrock.yaml` = S3 source bucket, Bedrock KB service role) idempotently via the same OIDC role.

The frontend is hosted on Amplify (auto-deploys on push to `main`/`dev`).

See [docs/deployment.md](docs/deployment.md) and [docs/aws-resources.md](docs/aws-resources.md).
