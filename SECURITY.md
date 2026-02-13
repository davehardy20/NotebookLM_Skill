# Security Policy

## Security Overview

The notebooklm-ts project takes security seriously. This document outlines our security practices, vulnerability reporting process, and the security architecture implemented in this project.

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public GitHub issue**
2. Email security concerns to: davehardy20@gmail.com
3. Include detailed description and reproduction steps
4. Allow reasonable time for response before public disclosure

We follow responsible disclosure practices and will acknowledge receipt within 48 hours.

## Security Architecture

### Credential Storage (AES-256-GCM)

Browser authentication state (cookies, session tokens) is encrypted at rest using AES-256-GCM:

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Derivation**: scrypt (N=16384, r=8, p=1)
- **Salt**: 16 bytes (random)
- **IV**: 12 bytes (random, GCM recommended)
- **Storage Format**: `ENC:v1:base64(salt:iv:ciphertext:authTag)`

To enable encryption:

```bash
export STATE_ENCRYPTION_KEY="your-32-character-key-here"
./scripts/notebooklm auth setup
```

**Migration**: Existing unencrypted state files are automatically migrated to encrypted format with backups created.

### File Permissions

Sensitive data files enforce strict Unix permissions:

- **Data directory** (`~/.claude/skills/notebooklm/data/`): 700 (user rwx only)
- **State files** (state.json, auth_info.json): 600 (user rw only)
- **Cache files**: 600 (user rw only)

Permissions are validated and auto-corrected on application startup.

### URL Validation

All notebook URLs are validated before use:

- **Protocol**: HTTPS only (file://, javascript://, data:// blocked)
- **Domain whitelist**: notebooklm.google.com, google.com
- **Path traversal**: Blocks `..`, `%2e%2e`, and encoded variants
- **Schema validation**: Zod schema with strict validation

### Rate Limiting

Parallel notebook queries are rate-limited to prevent resource exhaustion:

- **Default limit**: 10 concurrent queries
- **Environment override**: `MAX_PARALLEL_QUERIES=20`
- **Error handling**: ValidationError with clear message when exceeded

## Security Best Practices for Users

### Production Deployment

1. **Enable encryption** (required for production):

   ```bash
   export STATE_ENCRYPTION_KEY=$(openssl rand -base64 32)
   ```

2. **Verify file permissions**:

   ```bash
   ls -la ~/.claude/skills/notebooklm/data/
   # Should show: drwx------ for directories, -rw------- for files
   ```

3. **Use HTTPS URLs only** - The application enforces this

4. **Keep dependencies updated**:
   ```bash
   npm audit
   npm update
   ```

### Environment Security

- Store `STATE_ENCRYPTION_KEY` securely (e.g., password manager, environment file)
- Do not commit encryption keys to version control
- Use `.env` file with proper `.gitignore` exclusions
- Rotate encryption keys periodically

### Access Control

- Data directory should only be accessible by the owning user
- Do not run with sudo/root privileges
- On shared systems, ensure home directory permissions are restrictive

## Vulnerability History

### 2026-02-13 - Security Fixes Release

Fixed 5 vulnerabilities identified in security audit:

| ID       | Severity       | CVE/CWE             | Description                    | Fix                      |
| -------- | -------------- | ------------------- | ------------------------------ | ------------------------ |
| VULN-001 | Critical (7.5) | CWE-312             | Unencrypted credential storage | AES-256-GCM encryption   |
| VULN-002 | High (6.5)     | CWE-732             | Insecure file permissions      | Unix permissions 600/700 |
| VULN-003 | High (7.2)     | CWE-20              | Missing URL validation         | Zod schema validation    |
| VULN-004 | High (6.5)     | CWE-770             | Unrestricted parallel queries  | Rate limiting (max 10)   |
| VULN-005 | High (6.6)     | GHSA-22r3-9w55-cj54 | pkg dependency vulnerability   | Removed pkg dependency   |

**Commit**: See git history for detailed changes

## Compliance

This project aims to follow security best practices for:

- **OWASP Top 10** (2021)
- **CWE Top 25** Most Dangerous Software Weaknesses
- **GDPR** Article 32 (Security of Processing) - when encryption enabled

## Security Checklist

Before production deployment, verify:

- [ ] `STATE_ENCRYPTION_KEY` is set (32+ characters)
- [ ] File permissions are 700/600 (Unix systems)
- [ ] `npm audit` shows no high/critical vulnerabilities
- [ ] Only HTTPS notebook URLs are used
- [ ] MAX_PARALLEL_QUERIES is appropriate for your use case
- [ ] Data directory is not shared or world-accessible

## Third-Party Security

This tool interacts with:

- **Google NotebookLM**: Subject to Google's security practices
- **Playwright**: Browser automation library
- **Node.js**: Runtime environment

Users are responsible for:

- Securing their Google account credentials
- Keeping Node.js runtime patched
- Reviewing Playwright security advisories

## Audit History

| Date       | Auditor              | Scope           | Findings                |
| ---------- | -------------------- | --------------- | ----------------------- |
| 2026-02-13 | AI-assisted (Oracle) | Full repository | 5 vulnerabilities fixed |

## Contact

For security questions or concerns:

- GitHub Issues (for non-sensitive topics)
- Email: davehardy20@gmail.com (for sensitive security matters)
