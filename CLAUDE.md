# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. It uses Claude to generate components in a virtual file system that can be previewed in real-time without writing files to disk.

## Development Commands

- `npm run setup` - Initial setup: installs dependencies, generates Prisma client, and runs database migrations
- `npm run dev` - Start development server with Turbopack
- `npm run dev:daemon` - Start development server in background with logs written to logs.txt
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests with Vitest
- `npm run db:reset` - Reset database with Prisma migrate reset

## Architecture

### Virtual File System
The core innovation is a virtual file system (`src/lib/file-system.ts`) that exists only in memory:
- **VirtualFileSystem class**: Manages virtual files and directories with CRUD operations
- **FileSystemContext**: React context that provides file system operations to components
- Components can be generated, edited, and previewed without touching the actual disk
- File system state is serialized and stored in the database for persistence

### AI Integration
- **Generation endpoint**: `/src/app/api/chat/route.ts` handles chat requests and AI tool execution  
- **AI Tools**: 
  - `str_replace_editor` (str-replace.ts) - Create and modify files with string replacement
  - `file_manager` (file-manager.ts) - Rename and delete files/directories
- **Provider system**: Supports Anthropic Claude API with fallback to mock provider when no API key is provided
- **Generation prompt**: (`src/lib/prompts/generation.tsx`) defines how the AI should create React components

### Component Structure  
- **App Router**: Uses Next.js 15 App Router with TypeScript
- **UI Components**: Built with Radix UI and Tailwind CSS v4
- **Editor**: Monaco Editor for code editing with syntax highlighting
- **Preview**: Live preview using iframe with hot reload
- **Chat Interface**: Real-time streaming chat with AI for iterative component development

### Database & Auth
- **Database**: SQLite with Prisma ORM
- **Schema**: Users and Projects models with optional anonymous usage
- **Auth**: JWT-based authentication with server-only utilities
- **Persistence**: Chat messages and virtual file system state stored per project

### Key Contexts
- **FileSystemContext**: Manages virtual file operations and selected files
- **ChatContext**: Handles chat state, AI streaming, and tool execution

## File Organization

```
src/
├── app/                 # Next.js app router pages and API routes
├── components/
│   ├── ui/             # Reusable UI components (Radix + Tailwind)
│   ├── editor/         # Code editor and file tree components  
│   ├── preview/        # Component preview frame
│   ├── chat/          # Chat interface components
│   └── auth/          # Authentication forms
├── lib/
│   ├── contexts/      # React contexts (file system, chat)
│   ├── tools/         # AI tool implementations
│   ├── transform/     # JSX transformation utilities
│   └── prompts/       # AI generation prompts
├── actions/           # Server actions for projects
└── hooks/             # Custom React hooks
```

## Testing

- **Framework**: Vitest with jsdom environment
- **Library**: React Testing Library
- **Coverage**: Tests exist for core file system, contexts, and chat components
- Use `npm run test` to run all tests

## Development Notes

- Virtual file system always requires `/App.jsx` as the entry point for generated components
- All non-library imports use `@/` alias (e.g. `@/components/Button`)  
- Components are styled with Tailwind CSS, not inline styles
- The AI is instructed to be brief and focus on implementation over explanations
- Anonymous users can use the system but won't have project persistence
- When no Anthropic API key is provided, a mock provider generates static example components