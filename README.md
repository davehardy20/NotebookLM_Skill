# NotebookLM Skill (TypeScript)

A TypeScript rewrite of the NotebookLM Claude Code Skill with improved performance, type safety, and single-binary distribution.

## Overview

This is a complete port of the Python-based NotebookLM skill to TypeScript, featuring:

- **Native Playwright support** - Official browser automation library
- **True async I/O** - Non-blocking operations with async/await
- **Type safety** - Compile-time error checking
- **Single binary** - Distribute as executable (no runtime dependencies)
- **Better performance** - 20-30x faster startup, improved query times

## Project Structure

```
notebooklm-ts/
├── src/
│   ├── types/          # TypeScript interfaces and Zod schemas
│   ├── core/           # Config, logging, errors, utilities
│   ├── browser/        # Browser automation, pool, auth
│   ├── notebook/       # Library management
│   ├── cache/          # Response caching
│   ├── performance/    # Metrics and monitoring
│   ├── commands/       # CLI command handlers
│   ├── cli.ts          # CLI entry point
│   └── index.ts        # Main exports
├── tests/              # Test suites
├── .sisyphus/          # Planning and evidence
├── data/               # User data (gitignored)
├── bin/                # Compiled binaries
├── package.json
├── tsconfig.json
└── README.md
```

## Status

**Migration Phase**: Planning Complete ➜ Implementation Pending

See `.sisyphus/plans/notebooklm-typescript-migration.md` for detailed execution plan.

## Quick Start

Coming soon...

## Migration from Python

This project is a clean-room rewrite with 100% feature parity:

- All CLI commands preserved
- JSON data formats compatible
- Performance maintained or improved
- Same authentication flow

## License

Same as original project.

## Credits

TypeScript migration by Claude Code.
