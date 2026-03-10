# Agent Hub

Standalone chat interface for interacting with published AI agents in Bee Flow.

## Getting Started

### Prerequisites
- Node.js 18+
- Bee Flow server running on port 3001

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5175`

### Configuration

Set `VITE_API_URL` environment variable to point to a different backend:

```bash
VITE_API_URL=https://api.example.com npm run dev
```

### Production Build

```bash
npm run build
npm run preview
```

## Features

- Chat with published AI agents
- Real-time streaming responses
- Conversation history
- Starter prompts for quick interactions
- Dark/light theme support
