# notebooklm-ts - NotebookLM CLI Tool

**Generated:** 2026-02-19  
**Repository:** https://github.com/davehardy20/NotebookLM_Skill.git  
**Language:** TypeScript  
**Runtime:** Bun/Node.js  
**Type:** Claude Code Skill / CLI Tool

---

## OVERVIEW

TypeScript-based CLI tool for Google NotebookLM integration. Enables querying NotebookLM notebooks directly from the command line with browser automation via Playwright. Provides persistent authentication, notebook library management, response caching, and performance monitoring.

---

## STRUCTURE

```
.
├── src/
│   ├── cli.ts              # CLI entry point (Commander.js)
│   ├── index.ts            # Main exports for programmatic API
│   ├── ask.ts              # Core query functionality
│   ├── browser/            # Browser automation (Playwright)
│   │   ├── auth-manager.ts # Authentication handling
│   │   ├── browser-pool.ts # Session pooling for performance
│   │   └── browser-utils.ts # Browser utilities
│   ├── commands/           # CLI command handlers
│   │   ├── auth.ts         # Authentication commands
│   │   ├── notebook.ts     # Notebook management
│   │   ├── ask.ts          # Query commands
│   │   ├── cache.ts        # Cache management
│   │   ├── perf.ts         # Performance monitoring
│   │   └── history.ts      # Query history
│   ├── core/               # Core utilities
│   │   ├── config.ts       # Configuration management
│   │   ├── errors.ts       # Error classes
│   │   ├── logger.ts       # Logging utilities
│   │   └── paths.ts        # Path resolution (XDG compliant)
│   ├── notebook/           # Notebook library management
│   ├── cache/              # Response caching
│   ├── performance/        # Performance monitoring
│   └── types/              # TypeScript type definitions
├── bin/                    # Compiled binaries (gitignored)
├── dist/                   # Compiled JavaScript output
├── tests/                  # Test suite
├── package.json
├── tsconfig.json
├── SKILL.md                # Claude Code skill instructions
├── COMMANDS.md             # Complete command reference
└── README.md
```

---

## WHERE TO LOOK

| Task                   | Location                           | Notes                      |
| ---------------------- | ---------------------------------- | -------------------------- |
| **CLI entry**          | `src/cli.ts`                       | Commander.js CLI setup     |
| **Core query**         | `src/ask.ts`                       | Main query logic           |
| **Browser automation** | `src/browser/`                     | Playwright integration     |
| **Authentication**     | `src/browser/auth-manager.ts`      | Google auth handling       |
| **Notebook mgmt**      | `src/notebook/notebook-manager.ts` | Library operations         |
| **Cache**              | `src/cache/response-cache.ts`      | Response caching           |
| **Build output**       | `dist/`                            | Compiled JavaScript        |
| **Binary**             | `bin/notebooklm`                   | Compiled standalone binary |

---

## CONVENTIONS

### CLI Architecture

- Single unified CLI using Commander.js
- Subcommand structure: `notebooklm <command> <subcommand>`
- Consistent error handling with structured error classes
- Progress indicators using `ora` for long-running operations
- Colored output using `chalk`

### Browser Automation

- Playwright for browser control
- Persistent context for session reuse
- Resource blocking for performance
- Stealth measures to avoid detection
- Automatic cleanup on exit (SIGINT, SIGTERM)

### TypeScript Patterns

- Strict TypeScript configuration
- Explicit return types on public functions
- Interface-driven development
- Zod schemas for runtime validation

### Data Storage

- XDG Base Directory specification compliant
- Secure file permissions (700/600 on Unix)
- Optional AES-256-GCM encryption for sensitive data
- JSON-based storage for library, cache, and history

---

## ANTI-PATTERNS

- **NEVER** commit API keys or credentials
- **NEVER** use `any` type without justification
- **NEVER** skip error handling for API calls
- **NEVER** run with sudo/root privileges
- **NEVER** store encryption keys in version control

---

## COMMANDS

```bash
# Install dependencies
bun install

# Build TypeScript
bun run build

# Build standalone binary
bun run build:binary

# Run tests
bun test

# Development mode with hot reload
bun run dev

# CLI commands (after adding to PATH)
notebooklm --help
notebooklm auth setup
notebooklm notebook list
notebooklm ask "Your question"
```

---

## NOTES

### CLI Commands

- `auth` - Authentication management (setup, status, validate, clear)
- `notebook` - Notebook library management (add, list, search, activate, remove)
- `ask` - Query notebooks with questions
- `cache` - Cache management (stats, clear, clean)
- `perf` - Performance monitoring (stats, report)
- `history` - Query history tracking

### Environment Variables

- `NOTEBOOKLM_LOG_LEVEL` - Logging level (debug, info, warn, error)
- `NOTEBOOKLM_SKILL_DIR` - Custom skill directory
- `NOTEBOOKLM_DATA_DIR` - Custom data directory
- `STATE_ENCRYPTION_KEY` - Encryption key for browser state (32+ chars)
- `MAX_PARALLEL_QUERIES` - Limit concurrent queries (default: 10)

### Data Locations

Default: `~/.claude/skills/notebooklm/data/`

- `library.json` - Notebook library
- `auth_info.json` - Authentication metadata
- `browser_state/` - Browser session data
- `response_cache.json` - Cached responses
- `history.json` - Query history
- `logs/` - Application logs

### Integration

Works with Claude Code via SKILL.md instructions. Can also be used standalone from any terminal.

---

## Session Completion Protocol (NON-NEGOTIABLE)

**When ending a work session**, you MUST complete ALL steps below.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up within seeds
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items

   ```

   ```

4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   sd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session
8. Work is NOT complete until `git push` succeeds.

**CRITICAL RULES:**

- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
