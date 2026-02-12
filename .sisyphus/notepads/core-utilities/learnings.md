# Core Utilities Implementation - Learnings

## Date: February 12, 2026

### Implementation Summary

Successfully created all four core utility modules for the NotebookLM TypeScript skill:

1. **config.ts** - Configuration management with Zod validation
2. **paths.ts** - XDG Base Directory compliant path resolution
3. **logger.ts** - Pino-based structured logging
4. **errors.ts** - Custom error class hierarchy

### Key Patterns Used

#### Configuration Management (config.ts)
- Zod schema for runtime validation of all config values
- Environment variable loading with sensible defaults
- Singleton pattern for global config instance
- Type-safe Config type exported for use throughout app
- Supports custom env vars for all paths and selectors

#### Path Resolution (paths.ts)
- XDG Base Directory Specification compliance
- Singleton pattern for Paths class
- Respects XDG_DATA_HOME, XDG_CONFIG_HOME, XDG_CACHE_HOME env vars
- Falls back to ~/.local/share, ~/.config, ~/.cache on Linux/macOS
- All paths derived from base directories for consistency

#### Structured Logging (logger.ts)
- Pino logger with environment-aware configuration
- Pretty printing in development (colorized, readable)
- JSON output in production (machine-parseable)
- Child logger support for module-specific logging
- Configurable log level via LOG_LEVEL env var

#### Error Handling (errors.ts)
- Base AppError class with code and statusCode properties
- Specialized error classes: AuthError, BrowserError, NotebookError, ConfigError, TimeoutError, ValidationError, NotFoundError
- Proper prototype chain setup for instanceof checks
- Type guard function (isAppError) for runtime type checking
- HTTP status codes included for API responses

### TypeScript Configuration Issues Resolved

**Problem:** ESM imports with moduleResolution 'node16' require explicit .js extensions
**Solution:** Added .js extensions to all relative imports in src/core and src/types

**Problem:** Pino default export not callable in strict TypeScript
**Solution:** Used named import `{ pino as createPino }` and imported helper functions directly

### Build Verification

- ✅ TypeScript compilation: 0 errors
- ✅ LSP diagnostics: Clean on all files
- ✅ Build output: 17.46 KB (index.js), 21.29 KB (index.d.ts)
- ✅ Module exports: 34 items (config, logger, errors, paths + types)

### Design Decisions

1. **Singleton Pattern for Config & Paths**: Ensures single source of truth, lazy initialization
2. **Zod Validation**: Catches config errors at startup, not runtime
3. **XDG Compliance**: Respects user's system conventions, portable across Linux/macOS/Windows
4. **Environment-Aware Logger**: Balances developer experience (pretty) with production needs (JSON)
5. **Error Hierarchy**: Allows specific error handling while maintaining common interface

### Files Created

```
src/core/
├── config.ts      (147 lines) - Configuration with Zod validation
├── paths.ts       (73 lines)  - XDG-compliant path resolution
├── logger.ts      (43 lines)  - Pino structured logging
└── errors.ts      (70 lines)  - Custom error classes
```

### Exports Available

All modules properly exported from src/index.ts:
- `config` - Singleton config instance
- `getConfig()` - Get config instance
- `resetConfig()` - Reset for testing
- `logger` - Singleton logger instance
- `createChildLogger(module)` - Create module-specific logger
- Error classes: AppError, AuthError, BrowserError, NotebookError, ConfigError, TimeoutError, ValidationError, NotFoundError
- `isAppError()` - Type guard function
- `Paths` - Path resolution class

### Next Steps

These core utilities are ready for use by:
- Browser automation modules (browser/)
- Notebook management (notebook/)
- Authentication (auth/)
- CLI commands (commands/)
- Cache layer (cache/)
- Performance monitoring (performance/)
