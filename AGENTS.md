# notebooklm-ts - NotebookLM MCP Server

**Generated:** 2026-02-19  
**Repository:** https://github.com/davehardy20/notebooklm-ts.git  
**Language:** TypeScript  
**Runtime:** Bun/Node.js  
**Type:** Model Context Protocol (MCP) Server

---

## OVERVIEW

TypeScript-based MCP (Model Context Protocol) server for Google NotebookLM integration. Enables programmatic access to NotebookLM notebooks, sources, and queries directly from Claude Code and other MCP clients.

---

## STRUCTURE

```
.
├── src/
│   ├── index.ts            # Main entry point
│   ├── server.ts           # MCP server implementation
│   ├── notebooklm-client.ts # NotebookLM API client
│   ├── types.ts            # TypeScript type definitions
│   └── utils.ts            # Utility functions
├── dist/                   # Compiled output
├── tests/                  # Test suite
├── package.json
├── tsconfig.json
└── README.md
```

---

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| **MCP server setup** | `src/server.ts` | Implements MCP protocol |
| **NotebookLM API** | `src/notebooklm-client.ts` | Google API integration |
| **Type definitions** | `src/types.ts` | Interface definitions |
| **Build output** | `dist/` | Compiled JavaScript |

---

## CONVENTIONS

### MCP Protocol Implementation
- Follows Model Context Protocol specification
- Exposes tools for notebook operations
- Supports resource-based access to notebooks

### TypeScript Patterns
- Strict TypeScript configuration
- Explicit return types on public functions
- Interface-driven development

### API Client Pattern
- Singleton client for NotebookLM API
- Authentication via environment variables
- Rate limiting and retry logic

---

## ANTI-PATTERNS

- **NEVER** commit API keys or credentials
- **NEVER** use `any` type without justification
- **NEVER** skip error handling for API calls

---

## COMMANDS

```bash
# Install dependencies
bun install

# Build
bun build

# Run tests
bun test

# Start MCP server
bun run start

# Development mode with hot reload
bun run dev
```

---

## NOTES

### MCP Tools Exposed
- Query notebooks
- List sources
- Add/remove sources
- Generate audio overviews

### Environment Variables
- `NOTEBOOKLM_API_KEY` - Google API authentication
- `MCP_TRANSPORT` - Transport type (stdio/sse)

### Integration
Works with Claude Code, OpenCode, and any MCP-compatible client.

<!-- mulch:start -->
## Project Expertise (Mulch)

This project uses [Mulch](https://github.com/jayminwest/mulch) for structured expertise management.

**At the start of every session**, run:
```bash
mulch prime
```

This injects project-specific conventions, patterns, decisions, and other learnings into your context.
Use `mulch prime --files src/foo.ts` to load only records relevant to specific files.

**Before completing your task**, review your work for insights worth preserving — conventions discovered,
patterns applied, failures encountered, or decisions made — and record them:
```bash
mulch record <domain> --type <convention|pattern|failure|decision|reference|guide> --description "..."
```

Link evidence when available: `--evidence-commit <sha>`, `--evidence-bead <id>`

Run `mulch status` to check domain health and entry counts.
Run `mulch --help` for full usage.
Mulch write commands use file locking and atomic writes — multiple agents can safely record to the same domain concurrently.

### Before You Finish

1. Discover what to record:
   ```bash
   mulch learn
   ```
2. Store insights from this work session:
   ```bash
   mulch record <domain> --type <convention|pattern|failure|decision|reference|guide> --description "..."
   ```
3. Validate and commit:
   ```bash
   mulch sync
   ```
<!-- mulch:end -->

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
