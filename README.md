# NotebookLM Skill (TypeScript)

A TypeScript implementation of the NotebookLM Claude Code Skill with improved performance, type safety, and modern tooling. Query your Google NotebookLM notebooks directly from the command line for source-grounded, citation-backed answers from Gemini.

## Overview

This is a TypeScript port of the Python-based NotebookLM skill, featuring:

- **Native Playwright support** - Official browser automation library
- **True async I/O** - Non-blocking operations with async/await
- **Type safety** - Compile-time error checking with TypeScript
- **Response caching** - Faster repeat queries with intelligent cache
- **Query history** - Track and review past conversations
- **Performance monitoring** - Track query times and success rates
- **Unified CLI** - Single interface for all operations
- **Modern tooling** - ESLint, Prettier, Vitest for development

## Features

### 🔐 Persistent Authentication

One-time Google login with automatic session persistence across queries.

### 📚 Notebook Library Management

Save and organize your NotebookLM URLs with metadata (topics, descriptions, tags).

### ⚡ Response Caching

Intelligent caching reduces response time for repeated questions.

### 📜 Query History

Automatically track all your queries with timestamps and notebook references.

### 📊 Performance Monitoring

Track query performance, success rates, and cache hit rates.

### 🎯 Smart Discovery

Query unknown notebooks first to discover content, then add to library.

## Project Structure

```
notebooklm/
├── src/                    # TypeScript source code
│   ├── types/             # TypeScript interfaces and Zod schemas
│   ├── core/              # Config, logging, errors, paths
│   ├── browser/           # Browser automation (Playwright)
│   ├── notebook/          # Library management
│   ├── cache/             # Response caching
│   ├── performance/       # Metrics and monitoring
│   ├── history/           # Query history tracking
│   ├── commands/          # CLI command handlers
│   ├── cli.ts             # CLI entry point
│   └── index.ts           # Main exports
├── scripts/               # CLI wrapper scripts
│   ├── notebooklm         # Main CLI wrapper
│   └── notebooklm.cjs     # Node.js wrapper implementation
├── dist/                  # Compiled JavaScript output
├── tests/                 # Test suites
├── data/                  # User data (gitignored)
│   ├── library.json       # Notebook metadata
│   ├── response_cache.json # Cached responses
│   ├── history.json       # Query history
│   ├── browser_state/     # Authentication state
│   └── logs/              # Application logs
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── SKILL.md               # Claude Code skill instructions
├── COMMANDS.md            # Complete command reference
└── README.md              # This file
```

## Prerequisites

- **Bun** >= 1.0.0 (recommended) or **Node.js** >= 20.0.0
- **Playwright** (will be installed automatically as a peer dependency)
- **Google Chrome** (installed automatically by Playwright if not present)

## Installation

### Option 1: Install via bunx (Recommended - No Clone Required)

The fastest way to get started is using `bunx` which automatically downloads and caches the latest version:

```bash
# Install Playwright globally (required external dependency)
bun install -g playwright

# Run directly with bunx
bunx notebooklm-skill --help

# Or install globally
bun install -g notebooklm-skill
notebooklm --help
```

**Note:** Playwright is an external dependency and must be installed separately because it includes native browser binaries that cannot be bundled.

### Option 2: Clone and Build from Source

```bash
# Create skills directory if it does not exist
mkdir -p ~/.claude/skills

# Clone the repository
cd ~/.claude/skills
git clone https://github.com/davehardy20/NotebookLM_Skill.git notebooklm

# Navigate to the skill directory
cd notebooklm

# Install dependencies with bun
bun install

# The binary will be automatically compiled during postinstall
# Or manually build it:
bun run build:binary
```

### 3. Verify Installation

```bash
# Check CLI is working
notebooklm --help
```

### 4. Initial Setup

```bash
# Authenticate with Google (opens browser)
notebooklm auth setup

# Verify authentication
notebooklm auth status

# Add your first notebook
notebooklm notebook add \
  "https://notebooklm.google.com/notebook/YOUR_NOTEBOOK_ID" \
  -n "My Notebook" \
  -d "Description" \
  -t "topic1,topic2"
```

## Quick Start

```bash
# Authenticate (one-time)
notebooklm auth setup

# Add a notebook
notebooklm notebook add "URL" -n "Name" -d "Description" -t "topics"

# List notebooks
notebooklm notebook list

# Ask a question
notebooklm ask "What are the key concepts?"

# Query specific notebook
notebooklm ask "Explain error handling" --id notebook-id

# Check performance
notebooklm perf stats
```

See [COMMANDS.md](./COMMANDS.md) for the complete command reference with examples.

## Key Commands

### Authentication

- `notebooklm auth setup` - Initial authentication
- `notebooklm auth status` - Check authentication
- `notebooklm auth validate` - Test if auth is valid

### Notebook Management

- `notebooklm notebook add URL -n NAME -d DESC -t TOPICS` - Add notebook
- `notebooklm notebook list` - List all notebooks
- `notebooklm notebook search QUERY` - Search notebooks
- `notebooklm notebook activate ID` - Set active notebook
- `notebooklm notebook stats` - Show library statistics

### Queries

- `notebooklm ask "question"` - Query active/default notebook
- `notebooklm ask "question" --id ID` - Query specific notebook
- `notebooklm ask "question" --url URL` - Query by URL
- `notebooklm ask "question" --save` - Save to history

### Cache and Performance

- `notebooklm cache stats` - View cache statistics
- `notebooklm cache clear` - Clear all cache
- `notebooklm perf stats` - View performance metrics
- `notebooklm history` - View query history

## Differences from Python Version

| Feature          | Python Version   | TypeScript Version |
| ---------------- | ---------------- | ------------------ |
| **Runtime**      | Python 3.8+      | Node.js 20+        |
| **Browser**      | Patchright       | Playwright         |
| **Distribution** | Source + venv    | Compiled + wrapper |
| **Caching**      | No               | Yes                |
| **History**      | No               | Yes                |
| **Performance**  | No               | Yes                |
| **Type Safety**  | No               | Yes                |
| **CLI**          | Multiple scripts | Unified interface  |

## Development

```bash
# Run in development mode
bun run dev

# Run tests
bun run test

# Type check
bun run typecheck

# Lint
bun run lint

# Format code
bun run format
```

## Data Storage

All user data is stored in `~/.claude/skills/notebooklm/data/`:

- `library.json` - Notebook metadata and library
- `response_cache.json` - Cached query responses
- `history.json` - Query history
- `browser_state/` - Authentication cookies and session
- `logs/` - Application logs

**Security:** The `data/` directory is protected by `.gitignore` and should never be committed.

## Environment Variables

```bash
# Optional: Custom paths
NOTEBOOKLM_SKILL_DIR=/custom/path
NOTEBOOKLM_DATA_DIR=/custom/data

# Optional: Log level
NOTEBOOKLM_LOG_LEVEL=debug  # debug, info, warn, error
```

## Troubleshooting

See [COMMANDS.md](./COMMANDS.md#installation-troubleshooting) for detailed troubleshooting.

Quick fixes:

```bash
# Rebuild after issues
rm -rf node_modules dist
pnpm install
bun run build

# Clear auth and re-authenticate
notebooklm auth clear
notebooklm auth setup

# Clear cache
notebooklm cache clear
```

## Status

**Implementation Complete**

- All core features implemented
- Authentication working
- Notebook library management
- Query interface with caching
- Performance monitoring
- History tracking
- CLI with all commands

## License

MIT License - See LICENSE file for details.

## Credits

**TypeScript migration** by Claude Code.

**Inspiration:** This project is inspired by the [notebooklm-skill](https://github.com/PleasePrompto/notebooklm-skill) by PleasePrompto, which provided the original Python implementation and concept. This TypeScript version is a complete rewrite with additional features including caching, history tracking, and performance monitoring.

## Contributing

Contributions are welcome! Please ensure:

- TypeScript compiles without errors (`bun run typecheck`)
- Tests pass (`bun run test`)
- Code is formatted (`bun run format`)
- Linter passes (`bun run lint`)

## Support

- [COMMANDS.md](./COMMANDS.md) - Complete command reference
- [SKILL.md](./SKILL.md) - Claude Code skill instructions
- [Issues](https://github.com/davehardy20/NotebookLM_Skill/issues) - Bug reports and feature requests
