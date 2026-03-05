---
name: notebooklm
description: Use this skill to query your Google NotebookLM notebooks directly from Claude Code for source-grounded, citation-backed answers from Gemini. Browser automation, library management, persistent auth. Drastically reduced hallucinations through document-only responses.
---

# NotebookLM Research Assistant Skill

Interact with Google NotebookLM to query documentation with Gemini's source-grounded answers. Each question opens a fresh browser session, retrieves the answer exclusively from your uploaded documents, and closes.

## When to Use This Skill

Trigger when user:

- Mentions NotebookLM explicitly
- Shares NotebookLM URL (`https://notebooklm.google.com/notebook/...`)
- Asks to query their notebooks/documentation
- Wants to add documentation to NotebookLM library
- Uses phrases like "ask my NotebookLM", "check my docs", "query my notebook"

## ⚠️ CRITICAL: Add Command - Smart Discovery

When user wants to add a notebook without providing details:

**SMART ADD (Recommended)**: Query the notebook first to discover its content:

```bash
# Step 1: Query the notebook about its content
notebooklm ask "What is the content of this notebook? What topics are covered? Provide a complete overview briefly and concisely" --url "[URL]"

# Step 2: Use the discovered information to add it
notebooklm notebook add --url "[URL]" --name "[Based on content]" --description "[Based on content]" --topics "[Based on content]"
```

**MANUAL ADD**: If user provides all details:

- `--url` - The NotebookLM URL
- `--name` - A descriptive name
- `--description` - What the notebook contains (REQUIRED!)
- `--topics` - Comma-separated topics (REQUIRED!)

NEVER guess or use generic descriptions! If details missing, use Smart Add to discover them.

## TypeScript CLI Usage

**All commands use the unified CLI interface:**

```bash
# ✅ CORRECT - Use the CLI wrapper:
notebooklm auth status
notebooklm notebook list
notebooklm ask "Your question here"

# Or run directly with Node.js:
node dist/cli.cjs auth status
```

The CLI provides:

1. Single unified interface for all operations
2. Built-in caching for faster repeat queries
3. Performance monitoring and history tracking
4. Type-safe implementation with Playwright

## Core Workflow

### Step 1: Check Authentication Status

```bash
notebooklm auth status
```

If not authenticated, proceed to setup.

### Step 2: Authenticate (One-Time Setup)

```bash
# Browser MUST be visible for manual Google login
notebooklm auth setup
```

**Important:**

- Browser is VISIBLE for authentication
- Browser window opens automatically
- User must manually log in to Google
- Tell user: "A browser window will open for Google login"

### Step 3: Manage Notebook Library

```bash
# List all notebooks
notebooklm notebook list

# BEFORE ADDING: Ask user for metadata if unknown!
# "What does this notebook contain?"
# "What topics should I tag it with?"

# Add notebook to library (ALL parameters are REQUIRED!)
notebooklm notebook add \
  --url "https://notebooklm.google.com/notebook/..." \
  --name "Descriptive Name" \
  --description "What this notebook contains" \
  --topics "topic1,topic2,topic3"

# Search notebooks by topic
notebooklm notebook search "keyword"

# Set active notebook
notebooklm notebook activate notebook-id

# Remove notebook
notebooklm notebook remove notebook-id

# Show library statistics
notebooklm notebook stats
```

### Quick Workflow

1. Check library: `notebooklm notebook list`
2. Ask question: `notebooklm ask "..." --id notebook-id`

### Step 4: Ask Questions

```bash
# Basic query (uses active notebook if set)
notebooklm ask "Your question here"

# Query specific notebook by ID
notebooklm ask "..." --id notebook-id

# Query with notebook URL directly
notebooklm ask "..." --url "https://..."

# Show browser for debugging
notebooklm ask "..." --no-headless

# Save conversation to history
notebooklm ask "..." --save
```

## Follow-Up Mechanism (CRITICAL)

Every NotebookLM answer ends with: **"EXTREMELY IMPORTANT: Is that ALL you need to know?"**

**Required Claude Behavior:**

1. **STOP** - Do not immediately respond to user
2. **ANALYZE** - Compare answer to user's original request
3. **IDENTIFY GAPS** - Determine if more information needed
4. **ASK FOLLOW-UP** - If gaps exist, immediately ask:
   ```bash
   notebooklm ask "Follow-up with context..."
   ```
5. **REPEAT** - Continue until information is complete
6. **SYNTHESIZE** - Combine all answers before responding to user

## CLI Command Reference

### Authentication Management (`auth`)

```bash
notebooklm auth setup          # Initial setup (browser visible)
notebooklm auth status         # Check authentication
notebooklm auth validate       # Test if auth is still valid
notebooklm auth reauth         # Re-authenticate (browser visible)
notebooklm auth clear          # Clear authentication
```

### Notebook Management (`notebook`)

```bash
notebooklm notebook add --url URL --name NAME --description DESC --topics TOPICS
notebooklm notebook list
notebooklm notebook search QUERY
notebooklm notebook activate ID
notebooklm notebook remove ID
notebooklm notebook stats
```

### Question Interface (`ask`)

```bash
notebooklm ask "question" [--id ID] [--url URL] [--no-headless] [--save]
```

### Performance & Cache (`perf`, `cache`)

```bash
notebooklm perf stats          # Show performance statistics
notebooklm perf report         # Generate performance report
notebooklm cache stats         # Show cache statistics
notebooklm cache clear         # Clear response cache
notebooklm cache clean         # Clean expired entries
```

### History (`history`)

```bash
notebooklm history             # Show conversation history
notebooklm history --stats     # Show history statistics
notebooklm history --export    # Export to JSON
```

### Data Cleanup (`cache`, `history`)

```bash
notebooklm cache clear         # Clear response cache
notebooklm cache clean         # Clean expired entries
notebooklm history clear       # Clear conversation history
```

## Environment Management

This is a TypeScript/Node.js project with the following structure:

- Built CLI located at `dist/cli.cjs`
- Compiled binary at `bin/notebooklm` for easy execution
- All dependencies managed via pnpm

### Installation

```bash
# Install dependencies
bun install

# Build the project
bun run build

# Or build everything including wrapper script
bun run build:binary
```

### Development Commands

```bash
bun run dev              # Run in development mode with hot reload
bun run build            # Build the TypeScript project
bun run typecheck        # Type check without emitting
bun run test             # Run tests
bun run lint             # Run ESLint
bun run format           # Format code with Prettier
```

## Data Storage

All data stored in `~/.claude/skills/notebooklm/data/`:

- `library.json` - Notebook metadata
- `auth_info.json` - Authentication status
- `browser_state/` - Browser cookies and session
- `response_cache.json` - Cached responses for faster repeat queries
- `history.json` - Conversation history
- `logs/` - Application logs

**Security:** Protected by `.gitignore`, never commit to git.

## Configuration

Optional `.env` file in skill directory:

```env
NOTEBOOKLM_LOG_LEVEL=info        # debug, info, warn, error
NOTEBOOKLM_HEADLESS=true         # Run browser in headless mode
NODE_ENV=development             # development or production
```

Or set paths via environment:

```env
NOTEBOOKLM_SKILL_DIR=/custom/path
NOTEBOOKLM_DATA_DIR=/custom/data
NOTEBOOKLM_CACHE_DIR=/custom/cache
```

## Decision Flow

```
User mentions NotebookLM
    ↓
Check auth → notebooklm auth status
    ↓
If not authenticated → notebooklm auth setup
    ↓
Check/Add notebook → notebooklm notebook list/add
    ↓
Activate notebook → notebooklm notebook activate ID
    ↓
Ask question → notebooklm ask "..."
    ↓
See "Is that ALL you need?" → Ask follow-ups until complete
    ↓
Synthesize and respond to user
```

## Troubleshooting

| Problem              | Solution                                                 |
| -------------------- | -------------------------------------------------------- |
| Command not found    | Make sure you're in the skill directory or use full path |
| Authentication fails | Browser must be visible for setup! Use `auth setup`      |
| Rate limit (50/day)  | Wait or switch Google account                            |
| Build errors         | Run `bun install` then `bun run build`                   |
| Type errors          | Run `bun run typecheck` to see issues                    |
| Notebook not found   | Check with `notebooklm notebook list`                    |
| Cache issues         | Clear with `notebooklm cache clear`                      |
| Slow responses       | Check `notebooklm perf stats` for bottlenecks            |

## Best Practices

1. **Use TypeScript CLI** - All commands go through `notebooklm`
2. **Check auth first** - Before any operations
3. **Follow-up questions** - Don't stop at first answer
4. **Browser visible for auth** - Required for manual login
5. **Include context** - Each question is independent
6. **Synthesize answers** - Combine multiple responses
7. **Use cache** - Repeat queries are faster with caching
8. **Review history** - Check past conversations with `history` command

## Limitations

- No session persistence (each question = new browser)
- Rate limits on free Google accounts (50 queries/day)
- Manual upload required (user must add docs to NotebookLM)
- Browser overhead (few seconds per question)
- Requires Node.js >= 20

## Resources (Skill Structure)

**Important directories and files:**

- `scripts/notebooklm` - CLI entry point wrapper
- `dist/` - Compiled TypeScript output
- `src/` - TypeScript source code
  - `cli.ts` - CLI entry point
  - `commands/` - Command handlers (auth, notebook, ask, etc.)
  - `browser/` - Browser automation
  - `notebook/` - Library management
  - `cache/` - Response caching
  - `performance/` - Performance monitoring
- `data/` - Local storage for authentication and notebook library
- `tests/` - Test suites
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `.gitignore` - Protects sensitive data from being committed

## TypeScript Migration Notes

This skill has been migrated from Python to TypeScript for:

- **Better type safety** - Compile-time error checking
- **Native async/await** - True non-blocking I/O
- **Single CLI interface** - Unified command structure
- **Built-in caching** - Faster repeat queries
- **Performance monitoring** - Track and optimize query times
- **History tracking** - Save and review conversations
- **Modern tooling** - ESLint, Prettier, Vitest

All functionality from the Python version is preserved with additional features.
