# NotebookLM Skill (TypeScript)

A TypeScript implementation of the NotebookLM Claude Code Skill with improved performance, type safety, and modern tooling. Query your Google NotebookLM notebooks directly from the command line for source-grounded, citation-backed answers from Gemini.

## Overview

This is a TypeScript port of the Python-based NotebookLM skill, featuring:

- **Chrome DevTools Protocol (CDP) authentication** - Direct cookie extraction from Chrome
- **Cookie import support** - Import cookies from file (Netscape or JSON format)
- **True async I/O** - Non-blocking operations with async/await
- **Type safety** - Compile-time error checking with TypeScript
- **Response caching** - Faster repeat queries with intelligent cache
- **Query history** - Track and review past conversations
- **Performance monitoring** - Track query times and success rates
- **Unified CLI** - Single interface for all operations
- **Modern tooling** - ESLint, Prettier, Vitest for development

## Features

### 🔐 Multiple Authentication Methods

- **CDP authentication** - Extract cookies directly from Chrome with remote debugging
- **Cookie import** - Import cookies from browser extensions or exported files
- **Persistent sessions** - Save and reuse authentication across queries

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
│   ├── core/              # Config, logging, errors, paths, crypto
│   ├── auth/              # Authentication management (CDP, import)
│   ├── api/               # NotebookLM API client
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
│   ├── auth.json          # Encrypted authentication data
│   └── logs/              # Application logs
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── SKILL.md               # Claude Code skill instructions
├── COMMANDS.md            # Complete command reference
└── README.md              # This file
```

## Prerequisites

- **Bun** >= 1.0.0 (recommended) or **Node.js** >= 20.0.0
- **Google Chrome** - For CDP authentication method

## Installation

### Option 1: Clone and Build from Source

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

# Build the project
bun run build

# Or build standalone binary
bun run build:binary
```

### Option 2: Install via npm/bun (when published)

```bash
# Install globally
bun install -g notebooklm-skill
# or
npm install -g notebooklm-skill

notebooklm --help
```

### 3. Verify Installation

```bash
# Check CLI is working
notebooklm --help
```

### 4. Configure Required Encryption Key

Before authenticating, set `STATE_ENCRYPTION_KEY`. The CLI requires this key to encrypt locally stored authentication data, cached responses, and query history.

```bash
export STATE_ENCRYPTION_KEY="replace-this-with-a-unique-32-plus-character-secret"
```

Use a strong secret, keep it out of version control, and store it somewhere recoverable. If you later lose or change it, delete the local NotebookLM auth/cache/history files and authenticate again.

### 5. Initial Setup

**Option A: Authenticate using Chrome DevTools Protocol (CDP)**

```bash
# Start Chrome with remote debugging enabled
# macOS:
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Linux:
google-chrome --remote-debugging-port=9222

# Windows:
"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222

# In another terminal, authenticate
notebooklm auth login
```

**Option B: Import cookies from file**

```bash
# Export cookies from Chrome using a browser extension (e.g., "Get cookies.txt")
# Then import them
notebooklm auth import --file cookies.txt

# Verify authentication
notebooklm auth status
```

**Option C: Add your first notebook**

```bash
notebooklm notebook add \
  "https://notebooklm.google.com/notebook/YOUR_NOTEBOOK_ID" \
  -n "My Notebook" \
  -d "Description" \
  -t "topic1,topic2"
```

## Quick Start

```bash
# Required once per shell/session unless loaded from your shell profile
export STATE_ENCRYPTION_KEY="replace-this-with-a-unique-32-plus-character-secret"

# Start Chrome with remote debugging (in a separate terminal)
chrome --remote-debugging-port=9222

# Authenticate using CDP
notebooklm auth login

# Or import cookies from file
notebooklm auth import --file cookies.txt

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

- `notebooklm auth login [--port PORT]` - Authenticate using Chrome DevTools Protocol
- `notebooklm auth import --file PATH` - Import cookies from file
- `notebooklm auth status` - Check authentication status
- `notebooklm auth validate` - Test if auth is valid
- `notebooklm auth clear` - Clear authentication data

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
- `notebooklm cache clean` - Remove expired entries
- `notebooklm perf stats` - View performance metrics
- `notebooklm history` - View query history

## Authentication Methods

### Method 1: Chrome DevTools Protocol (CDP) - Recommended

This method connects to a running Chrome instance and extracts authentication cookies directly.

**Setup:**

1. Start Chrome with remote debugging:

   ```bash
   # macOS
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

   # Linux
   google-chrome --remote-debugging-port=9222
   ```

2. Log in to [NotebookLM](https://notebooklm.google.com) in Chrome

3. Run authentication:
   ```bash
   notebooklm auth login
   ```

**Benefits:**

- No manual cookie export needed
- Automatic token refresh
- Seamless integration with your existing Chrome session

### Method 2: Cookie Import

Import cookies exported from Chrome using browser extensions.

**Setup:**

1. Install a cookie export extension (e.g., "Get cookies.txt" for Chrome)
2. Go to [NotebookLM](https://notebooklm.google.com) and ensure you're logged in
3. Export cookies to a file
4. Import:
   ```bash
   notebooklm auth import --file cookies.txt
   ```

**Supported formats:**

- Netscape cookies.txt format
- JSON format (array of cookie objects)

## Differences from Python Version

| Feature          | Python Version   | TypeScript Version       |
| ---------------- | ---------------- | ------------------------ |
| **Runtime**      | Python 3.8+      | Node.js 20+ / Bun        |
| **Browser**      | Patchright       | Chrome DevTools Protocol |
| **Distribution** | Source + venv    | Compiled + wrapper       |
| **Caching**      | No               | Yes                      |
| **History**      | No               | Yes                      |
| **Performance**  | No               | Yes                      |
| **Type Safety**  | No               | Yes                      |
| **CLI**          | Multiple scripts | Unified interface        |

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
- `auth.json` - Encrypted authentication data
- `logs/` - Application logs

**Security:** The `data/` directory is protected by `.gitignore` and should never be committed. Authentication data, cache, and query history are encrypted at rest and require `STATE_ENCRYPTION_KEY`.

## Environment Variables

```bash
# Required: local data encryption for auth, cache, and history
STATE_ENCRYPTION_KEY=replace-this-with-a-unique-32-plus-character-secret

# Optional: Custom paths
NOTEBOOKLM_SKILL_DIR=/custom/path
NOTEBOOKLM_DATA_DIR=/custom/data

# Optional: Log level
NOTEBOOKLM_LOG_LEVEL=debug  # debug, info, warn, error
```

## Troubleshooting

### Chrome is not running with remote debugging

If you see this error when using `auth login`:

```bash
# Start Chrome with remote debugging
chrome --remote-debugging-port=9222
```

### Authentication expired

```bash
# Re-authenticate using CDP
notebooklm auth login

# Or re-import cookies
notebooklm auth import --file cookies.txt
```

### Other quick fixes

```bash
# Rebuild after issues
rm -rf node_modules dist
bun install
bun run build

# Clear auth and re-authenticate
notebooklm auth clear
notebooklm auth login

# Clear cache
notebooklm cache clear
```

See [COMMANDS.md](./COMMANDS.md#installation-troubleshooting) for detailed troubleshooting.

## Status

**Implementation Complete**

- All core features implemented
- CDP authentication working
- Cookie import functionality
- Notebook library management
- Query interface with caching
- Performance monitoring
- History tracking
- CLI with all commands

## License

MIT License - See LICENSE file for details.

## Credits

**TypeScript migration** by Claude Code.

**Inspiration:** This project is inspired by the [notebooklm-skill](https://github.com/PleasePrompto/notebooklm-skill) by PleasePrompto, which provided the original Python implementation and concept. This TypeScript version is a complete rewrite with additional features including CDP authentication, cookie import, caching, history tracking, and performance monitoring.

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
