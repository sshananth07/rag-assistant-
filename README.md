# RAG Assistant

A full-stack Retrieval-Augmented Generation (RAG) research assistant. Upload documents, parse them, and ask questions using a powerful Large Language Model.

## 🚀 Features

- **Document Ingestion**: Upload and parse PDFs and Word documents.
- **Semantic Search**: Generates text embeddings using a local Ollama model (`nomic-embed-text`) and stores them in Qdrant for fast similarity search.
- **Conversational AI**: Uses Google Generative AI (Gemini) to provide intelligent, context-aware answers based on the uploaded documents.
- **Session Management**: Create, switch, and delete chat sessions. Maintains chat history per session.
- **Streaming Responses**: Real-time streaming UI for a fast and interactive user experience.

## 🛠️ Technology Stack

This project is structured as a monorepo using `pnpm` workspaces.

### Frontend (`apps/web`)
- **Framework**: Next.js (React)
- **Styling**: TailwindCSS
- **Icons**: Lucide React

### Backend (`apps/api`)
- **Server**: Hono (Node.js)
- **Database**: libSQL (SQLite) with Drizzle ORM
- **AI & Processing**: LangChain, `@google/generative-ai`

### Infrastructure
- **Vector Database**: Qdrant
- **Local Embeddings**: Ollama
- **Containerization**: Docker & Docker Compose

## 📦 Prerequisites

- [Node.js](https://nodejs.org/) (v22 or later recommended)
- [pnpm](https://pnpm.io/installation)
- [Docker & Docker Compose](https://www.docker.com/)
- [Google Gemini API Key](https://aistudio.google.com/app/apikey)

## 🚦 Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Variables

Create a `.env` file in the root directory and add your Google API Key (you can use `.env.docker` as a reference):

```env
GOOGLE_API_KEY=your_gemini_api_key_here
```

### 3. Run with Docker Compose

The easiest way to start the entire stack (Qdrant, Ollama, API, and Web) is using Docker Compose:

```bash
docker-compose up --build
```

This will:
- Start the **Qdrant** vector database.
- Start **Ollama** and automatically download the `nomic-embed-text` model.
- Start the **API Backend** at `http://localhost:3001`.
- Start the **Next.js Web App** at `http://localhost:3000`.

### 4. Local Development (Without Docker for Node Apps)

If you prefer to run the applications locally outside of Docker for development, you can start just the infrastructure services:

```bash
docker-compose up qdrant ollama ollama-setup -d
```

Apply database migrations:

```bash
pnpm --filter api run db:generate
pnpm --filter api run db:migrate
```

Finally, start the development servers:

```bash
pnpm dev:api   # Starts the Hono backend server
pnpm dev:web   # Starts the Next.js frontend server
```

## 📂 Project Structure

- `apps/api`: The Hono-based backend server. Handles document processing, database interactions, and the LLM/RAG pipeline.
- `apps/web`: The Next.js frontend application.
- `docker-compose.yml`: Orchestrates the services required for the application.
