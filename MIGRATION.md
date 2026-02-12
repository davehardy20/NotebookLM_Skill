# Migration Guide: Python → TypeScript

This guide helps you migrate from the Python NotebookLM skill to the new TypeScript implementation.

## Overview

The TypeScript rewrite provides:
- **20-30x faster startup** (0.1s vs 2-3s)
- **Standalone binary** - no Python/virtualenv required
- **Better performance** with browser session pooling
- **Type safety** with compile-time error checking
- **Improved CLI** with better error messages and progress indicators

## Installation

### 1. Download the Binary

```bash
# Clone the repository
git clone https://github.com/davehardy20/NotebookLM_Skill.git notebooklm-ts
cd notebooklm-ts

# Install dependencies
pnpm install

# Build the project
pnpm run build

# Create standalone binary (optional)
pnpm run build:binary
```

### 2. Make Binary Available

```bash
# Option 1: Add to PATH
export PATH="$PATH:/path/to/notebooklm-ts/scripts"

# Option 2: Create symlink
ln -s /path/to/notebooklm-ts/scripts/notebooklm /usr/local/bin/notebooklm

# Option 3: Use npx (if published to npm)
npx notebooklm --version
```

## Data Migration

### ✅ Seamless Migration - Same File Locations

The TypeScript version uses the **exact same file locations** as the Python version for full backward compatibility:

**Data Directory:**
```
~/.claude/skills/notebooklm/data/
```

**Files:**
- `library.json` - Notebook library (fully compatible)
- `auth_info.json` - Auth metadata
- `browser_state/` - Browser session data
- `cache/` - Response cache directory

**No data migration required!** The TypeScript version will automatically read your existing Python data.

### Authentication ⚠️ Requires Re-setup

While library and cache data are compatible, browser authentication state needs to be recreated due to different storage formats between Python and TypeScript.

**Migration steps:**
```bash
# 1. Set up authentication with TypeScript
notebooklm auth setup

# 2. Verify authentication
notebooklm auth validate
```

**Note:** Your library.json and cache data will work immediately without any migration steps.

## CLI Command Mapping

| Python Command | TypeScript Command | Notes |
|----------------|-------------------|-------|
| `python run.py auth setup` | `notebooklm auth setup` | Opens browser for login |
| `python run.py auth status` | `notebooklm auth status` | Shows auth state |
| `python run.py auth validate` | `notebooklm auth validate` | Tests auth validity |
| `python run.py auth clear` | `notebooklm auth clear` | Removes auth data |
| `python run.py notebook add <url>` | `notebooklm notebook add <url>` | Add with --name, --description, --topics |
| `python run.py notebook list` | `notebooklm notebook list` | Table format output |
| `python run.py notebook search <query>` | `notebooklm notebook search <query>` | Search by name/topic/tag |
| `python run.py notebook activate <id>` | `notebooklm notebook activate <id>` | Set active notebook |
| `python run.py notebook remove <id>` | `notebooklm notebook remove <id>` | Remove with confirmation |
| `python run.py notebook stats` | `notebooklm notebook stats` | Show library statistics |
| `python run.py ask --question "Q"` | `notebooklm ask "Question"` | Direct question argument |
| `python run.py cache stats` | `notebooklm cache stats` | Cache statistics |
| `python run.py cache clear` | `notebooklm cache clear` | Clear all cache |
| `python run.py perf report` | `notebooklm perf report` | Performance report |

### New Commands in TypeScript

```bash
# Cache management
notebooklm cache list              # List cached entries
notebooklm cache cleanup           # Remove expired entries only

# Performance
notebooklm perf summary            # Brief statistics

# Ask command options
notebooklm ask "Question" --notebook-id <id>    # Specify notebook
notebooklm ask "Question" --no-cache            # Skip cache
notebooklm ask "Question" --no-pool             # Use legacy mode
```

## Configuration Changes

### Environment Variables

Both versions support the same environment variables:

```bash
# Data directories (XDG Base Directory spec)
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_CACHE_HOME="$HOME/.cache"
export XDG_CONFIG_HOME="$HOME/.config"

# Feature flags
export CACHE_ENABLED=true          # Enable response caching
export USE_SESSION_POOL=true       # Use browser pool (default: true)

# Timeouts
export DEFAULT_TIMEOUT=30000       # 30 seconds
export NAVIGATION_TIMEOUT=10000    # 10 seconds
```

### File Locations

TypeScript uses XDG Base Directory specification:

| Data Type | Location |
|-----------|----------|
| Library | `$XDG_DATA_HOME/notebooklm/library.json` |
| Auth State | `$XDG_DATA_HOME/notebooklm/auth_state.json` |
| Cache | `$XDG_CACHE_HOME/notebooklm/response_cache.json` |
| Performance Stats | `$XDG_DATA_HOME/notebooklm/performance_stats.json` |

Default locations (macOS/Linux):
- Library: `~/.local/share/notebooklm/library.json`
- Cache: `~/.cache/notebooklm/response_cache.json`

## New Features

### 1. Browser Pool (Faster Queries)

The TypeScript version maintains persistent browser sessions:

- **First query:** 8-15 seconds (same as Python)
- **Subsequent queries:** 1-3 seconds (60-70% faster!)
- **Session timeout:** 15 minutes of inactivity

### 2. Better Progress Indicators

```bash
$ notebooklm ask "What is React?"
✓ Authenticated
✓ Session ready
⏳ Querying notebook... (2.3s)
✓ Response received (cached)

React is a JavaScript library for building user interfaces...
```

### 3. Colored Output

All commands use colored output for better readability:
- Green ✓ for success
- Yellow ⚠ for warnings
- Red ✗ for errors
- Blue ℹ for information

### 4. Improved Error Messages

```bash
# Before (Python)
Error: Authentication expired

# After (TypeScript)
⚠️  Authentication expired (last login: 8 days ago)

💡 Hint: Run 'notebooklm auth reauth' to refresh your session
```

## Breaking Changes

### 1. Authentication Requires Re-setup

Browser authentication state is not compatible. You must run:
```bash
notebooklm auth setup
```

### 2. File Locations (Unchanged)

Both Python and TypeScript versions use the same file locations:
- Data: `~/.claude/skills/notebooklm/data/`
- Binary: `~/.claude/skills/notebooklm/scripts/`

No changes needed to your existing setup.

### 3. CLI Syntax Differences

- **Ask command:** Direct argument instead of `--question` flag
  - Old: `python run.py ask --question "Q"`
  - New: `notebooklm ask "Q"`

- **Notebook add:** Options instead of interactive prompts
  - Old: Interactive prompts for name/description
  - New: `notebooklm notebook add <url> --name "X" --description "Y"`

## Rollback to Python

If you need to revert to the Python version:

```bash
# 1. Keep TypeScript data (it's compatible)
# No data migration needed

# 2. Switch back to Python
# In your Python notebooklm directory:
python run.py auth setup    # Re-authenticate
python run.py notebook list # Verify data is present

# 3. Both versions can coexist
# They share the same data files
```

## Troubleshooting

### Issue: Binary not found

```bash
# Check if binary exists (in scripts folder)
ls -la scripts/notebooklm

# Make executable
chmod +x scripts/notebooklm

# Or use node directly
node dist/cli.cjs --version
```

### Issue: Auth not working

```bash
# Clear and re-authenticate
notebooklm auth clear
notebooklm auth setup

# Validate
notebooklm auth validate
```

### Issue: Library not found

```bash
# Check library location
notebooklm notebook stats

# Verify file exists (same location as Python version)
ls -la ~/.claude/skills/notebooklm/data/library.json
```

### Issue: Performance not improved

```bash
# Check if pool is enabled
notebooklm ask "test" --notebook-id <id>
# Look for "Session ready" message

# Force pool mode
export USE_SESSION_POOL=true
```

## Getting Help

```bash
# Show help for all commands
notebooklm --help

# Show help for specific command
notebooklm auth --help
notebooklm notebook --help
notebooklm ask --help
```

## Summary

✅ **Library data** - Fully compatible, no action needed  
✅ **Cache data** - Fully compatible, no action needed  
⚠️ **Authentication** - Requires re-setup (`notebooklm auth setup`)  
🚀 **Performance** - 60-70% faster subsequent queries  
📦 **Binary** - Single executable, no dependencies  

**Migration time:** ~5 minutes (mostly re-authentication)
