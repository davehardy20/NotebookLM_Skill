# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

#### Fixed 5 Security Vulnerabilities (2026-02-13)

Implemented comprehensive security fixes following security audit:

- **VULN-001** (Critical, CVSS 7.5): Unencrypted Credential Storage
  - Implemented AES-256-GCM encryption for browser state
  - Added automatic migration from unencrypted to encrypted state
  - Added `STATE_ENCRYPTION_KEY` environment variable
  - Files: `src/core/crypto.ts`, `src/browser/auth-manager.ts`

- **VULN-002** (High, CVSS 6.5): Insecure File Permissions
  - Enforced Unix file permissions 700/600 on sensitive data
  - Added automatic permission validation and correction on startup
  - Files: `src/core/paths.ts`, `src/browser/auth-manager.ts`, `src/cache/response-cache.ts`

- **VULN-003** (High, CVSS 7.2): Missing URL Validation
  - Implemented Zod schema validation for all notebook URLs
  - Blocks file://, javascript://, data:// protocols
  - Prevents path traversal attacks
  - Files: `src/core/validation.ts`, `src/ask.ts`, `src/commands/ask.ts`, `src/commands/notebook.ts`

- **VULN-004** (High, CVSS 6.5): Unrestricted Parallel Query Execution
  - Added rate limiting (MAX_PARALLEL_QUERIES=10)
  - Environment variable override support
  - Files: `src/parallel-ask.ts`, `src/core/config.ts`

- **VULN-005** (High, CVSS 6.6): pkg Dependency Vulnerability (GHSA-22r3-9w55-cj54)
  - Removed vulnerable `pkg@5.8.1` dependency
  - Files: `package.json`, `package-lock.json`

### Added

- New environment variables:
  - `STATE_ENCRYPTION_KEY`: Encryption key for browser state
  - `MAX_PARALLEL_QUERIES`: Override default parallel query limit
- Security documentation in `SECURITY.md`
- Automatic permission correction on startup

### Changed

- Browser state now encrypted when `STATE_ENCRYPTION_KEY` is set
- URLs validated before use in all commands
- Parallel queries limited to prevent resource exhaustion

## [1.0.0] - 2026-02-12

### Added

- Initial TypeScript implementation
- Browser automation with Playwright
- Authentication management with session persistence
- Notebook library management
- Response caching with LRU strategy
- Query history tracking
- Performance monitoring
- Unified CLI with all commands
- Unit test suite with Vitest

### Changed

- Migrated from Python to TypeScript
- Replaced Patchright with Playwright
- Added type safety with TypeScript and Zod

[Unreleased]: https://github.com/davehardy20/NotebookLM_Skill/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/davehardy20/NotebookLM_Skill/releases/tag/v1.0.0
