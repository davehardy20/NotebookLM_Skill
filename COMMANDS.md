# NotebookLM CLI Command Reference

Complete guide to installing and using the `notebooklm` CLI with practical examples.

## Installation

### Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** (recommended) or npm
- **Google Chrome** (will be installed by Playwright if not present)

### Step 1: Clone the Repository

```bash
# Create skills directory if it doesn't exist
mkdir -p ~/.claude/skills

# Clone the repository
cd ~/.claude/skills
git clone https://github.com/davehardy20/NotebookLM_Skill.git notebooklm

# Navigate to the skill directory
cd notebooklm
```

### Step 2: Install Dependencies

```bash
# Install Node.js dependencies
pnpm install

# Or with npm
npm install
```

### Step 3: Build the Project

```bash
# Build the TypeScript project
pnpm run build

# This creates the compiled CLI in dist/cli.cjs
```

### Step 4: Verify Installation

```bash
# Check CLI is working
./scripts/notebooklm --help

# You should see:
# Usage: notebooklm [options] [command]
# Options:
#   -v, --verbose           enable verbose logging
#   -c, --config <path>     path to configuration file
#   -h, --help              display help for command
#
# Commands:
#   auth                    Authentication management commands
#   notebook                Manage NotebookLM notebook library
#   ask                     Ask a question to a notebook
#   cache                   Manage response cache
#   perf                    Performance monitoring commands
#   history                 Query history management
```

### Step 5: Initial Setup

```bash
# 1. Authenticate with Google (opens browser)
./scripts/notebooklm auth setup

# 2. Verify authentication
./scripts/notebooklm auth status

# 3. Add your first notebook
./scripts/notebooklm notebook add \
  "https://notebooklm.google.com/notebook/YOUR_NOTEBOOK_ID" \
  -n "My First Notebook" \
  -d "Description of your notebook" \
  -t "topic1,topic2"

# 4. List notebooks to verify
./scripts/notebooklm notebook list
```

### Optional: Add to PATH

For easier access, add the scripts directory to your PATH:

```bash
# Add to your ~/.bashrc, ~/.zshrc, or ~/.bash_profile
export PATH="$HOME/.claude/skills/notebooklm/scripts:$PATH"

# Then reload your shell
source ~/.bashrc  # or ~/.zshrc

# Now you can use:
notebooklm --help
notebooklm auth status
```

### Updating the Skill

```bash
cd ~/.claude/skills/notebooklm

# Pull latest changes
git pull origin main

# Rebuild
pnpm install
pnpm run build
```

---

## Quick Reference

```bash
# Authentication
notebooklm auth setup|status|validate|reauth|clear

# Notebook Management
notebooklm notebook add|list|search|activate|remove|stats

# Queries
notebooklm ask "question" [--id ID] [--url URL] [--no-headless] [--save]

# Cache & Performance
notebooklm cache stats|clear|clean
notebooklm perf stats|report

# History
notebooklm history [--stats] [--export] [--clear]
```

---

## Authentication Commands (`auth`)

### `auth setup`

Run interactive authentication with Google.

```bash
# Open browser for Google login
notebooklm auth setup

# With custom timeout (default: 10 minutes)
notebooklm auth setup --timeout 15
```

**When to use:** First time setup, or when authentication expires.

**Note:** Browser must be visible for manual login. A Chrome window will open automatically.

---

### `auth status`

Check current authentication state.

```bash
# Quick status check
notebooklm auth status

# Output example:
# ✓ Authentication Status: Authenticated
# Session age: 2.3 hours ago
# State file: ~/.claude/skills/notebooklm/data/browser_state/state.json
```

---

### `auth validate`

Test if stored authentication is still valid.

```bash
# Verify auth is working
notebooklm auth validate

# With custom timeout
notebooklm auth validate --timeout 2
```

**When to use:** Before long sessions, if you suspect auth expired.

---

### `auth reauth`

Clear and re-authenticate.

```bash
# Start fresh authentication
notebooklm auth reauth
```

**When to use:** Authentication issues, switching Google accounts.

---

### `auth clear`

Remove all authentication data.

```bash
# Clear auth completely
notebooklm auth clear
```

**When to use:** Troubleshooting, privacy concerns.

---

## Notebook Management Commands (`notebook`)

### `notebook add`

Add a notebook to your library.

```bash
# Basic add with required fields
notebooklm notebook add "https://notebooklm.google.com/notebook/..." \
  -n "API Documentation" \
  -d "REST API reference and examples" \
  -t "api,rest,backend"

# Full example with all fields
notebooklm notebook add "https://notebooklm.google.com/notebook/abc123" \
  --name "Python Best Practices" \
  --description "Comprehensive guide to Python coding standards" \
  --topics "python,coding-standards,pep8" \
  --content-types "guide,reference" \
  --use-cases "code-review,learning" \
  --tags "must-read,official"
```

**Required:** `--name`, `--description`, `--topics`

**Tip:** Use the Smart Add pattern when you don't know the content:

```bash
# 1. Query to discover content
notebooklm ask "What topics does this notebook cover?" --url "URL"

# 2. Add with discovered information
notebooklm notebook add "URL" -n "Name" -d "Description" -t "topics"
```

---

### `notebook list`

Show all notebooks in your library.

```bash
# List all notebooks
notebooklm notebook list

# Output:
# 📚 Notebook Library
#
#   ID                    Name              Topics        Uses
#   ────────────────────  ────────────────  ────────────  ─────
#   api-docs              API Documentation api,rest      12
#   python-guide          Python Best Prac  python,pep8   5
#
#   ▸ = Active notebook
```

---

### `notebook search`

Find notebooks by keyword.

```bash
# Search by topic or name
notebooklm notebook search "python"
notebooklm notebook search "api"

# Search returns matches in name, description, or topics
```

---

### `notebook activate`

Set a notebook as the default for queries.

```bash
# Set active notebook
notebooklm notebook activate python-guide

# Verify
notebooklm notebook list
# (Shows ▸ next to active notebook)
```

**Benefit:** Queries without `--id` or `--url` will use the active notebook.

---

### `notebook remove`

Delete a notebook from library.

```bash
# Remove by ID
notebooklm notebook remove old-notebook

# Safe: asks for confirmation (if implemented)
```

---

### `notebook stats`

Show library statistics.

```bash
# View library overview
notebooklm notebook stats

# Output example:
# 📊 Library Statistics
#
#   Total Notebooks:  5
#   Total Topics:     23
#   Total Uses:       47
#   Active Notebook:  API Documentation
#   Most Used:        Python Guide (12 uses)
```

---

## Query Commands (`ask`)

### `ask`

Send a question to NotebookLM.

```bash
# Query active notebook
notebooklm ask "What are the authentication endpoints?"

# Query specific notebook by ID
notebooklm ask "Explain error handling" --id api-docs

# Query by URL (without adding to library)
notebooklm ask "Summary of content" --url "https://notebooklm.google.com/notebook/..."

# Show browser for debugging
notebooklm ask "Debug this issue" --no-headless

# Save conversation to history
notebooklm ask "Important question" --save

# Combine options
notebooklm ask "Complex query" \
  --id python-guide \
  --no-headless \
  --save
```

**Best Practices:**

- Be specific in your questions
- Include context ("In the API documentation...")
- Use `--save` for important queries you want to reference later
- Enable `--no-headless` if you're debugging browser issues

---

## Cache Commands (`cache`)

### `cache stats`

View cache performance metrics.

```bash
# Check cache statistics
notebooklm cache stats

# Output:
# 📦 Response Cache Statistics
#
#   Total Entries:     23
#   Expired Entries:   3
#   Hit Rate:          68.5%
#   Total Hits:        47
#   Cache Size:        156 KB
```

---

### `cache clear`

Remove all cached responses.

```bash
# Clear entire cache
notebooklm cache clear

# Confirm prompt: "Are you sure? (y/n)"
```

**When to use:** Cache corruption, outdated responses, storage concerns.

---

### `cache clean`

Remove only expired entries.

```bash
# Clean expired entries only
notebooklm cache clean

# Output: "Removed 5 expired entries"
```

**When to use:** Regular maintenance, free up space without losing valid cache.

---

## Performance Commands (`perf`)

### `perf stats`

View query performance metrics.

```bash
# Show performance statistics
notebooklm perf stats

# Output:
# ⚡ Performance Statistics
#
#   Total Queries:      156
#   Avg Response Time:  8.2s
#   Success Rate:       94.2%
#   Cache Hit Rate:     31%
```

---

### `perf report`

Generate detailed performance report.

```bash
# Generate report
notebooklm perf report

# Output saved to: ~/.claude/skills/notebooklm/data/logs/perf-report-2024-...
```

**Useful for:** Identifying slow queries, optimizing usage patterns.

---

## History Commands (`history`)

### `history`

View conversation history.

```bash
# Show recent queries
notebooklm history

# Output:
# 📜 Query History (Last 10)
#
#   2024-02-12 15:23  API Documentation
#   "What are the rate limits?"
#
#   2024-02-12 15:25  Python Guide
#   "Explain list comprehensions"
```

---

### `history --stats`

Show history statistics.

```bash
# View usage statistics
notebooklm history --stats

# Output:
# 📊 Query History Statistics
#
#   Total Queries:    47
#   Unique Notebooks: 5
#   This Week:        12
#   Most Active:      API Documentation (23 queries)
```

---

### `history --export`

Export history to JSON.

```bash
# Export to file
notebooklm history --export

# Saved to: ~/.claude/skills/notebooklm/data/history-export-2024-....json
```

---

### `history --clear`

Clear all history.

```bash
# Remove all history entries
notebooklm history --clear
```

---

## Common Workflows

### First-Time Setup

```bash
# 1. Authenticate
notebooklm auth setup

# 2. Check status
notebooklm auth status

# 3. Add your first notebook
notebooklm notebook add "URL" -n "Name" -d "Description" -t "topics"

# 4. Verify
notebooklm notebook list
```

### Daily Research Workflow

```bash
# 1. Check what's available
notebooklm notebook list

# 2. Set active notebook
notebooklm notebook activate my-docs

# 3. Ask questions
notebooklm ask "How do I implement X?"
notebooklm ask "What are the edge cases?" --save

# 4. Check performance
notebooklm perf stats
```

### Smart Notebook Discovery

```bash
# 1. Query unknown notebook
notebooklm ask "What topics does this notebook cover?" --url "NEW_URL"

# 2. Add with discovered info
notebooklm notebook add "NEW_URL" \
  -n "Discovered Name" \
  -d "Based on query response" \
  -t "topic1,topic2"
```

### Maintenance

```bash
# Weekly cleanup
notebooklm cache clean          # Remove expired entries
notebooklm notebook stats       # Check usage
notebooklm perf stats           # Review performance

# Monthly review
notebooklm history --stats      # See usage patterns
notebooklm cache stats          # Check hit rate
notebooklm perf report          # Detailed analysis
```

---

## Tips & Tricks

### Command Shortcuts

```bash
# Create aliases for frequently used notebooks
alias nb="notebooklm"
alias nb-ask="notebooklm ask"
alias nb-list="notebooklm notebook list"

# Usage
nb ask "Quick question"
nb-list
```

### Environment Variables

```bash
# Set default notebook
export NOTEBOOKLM_DEFAULT_NOTEBOOK="api-docs"

# Change log level
export NOTEBOOKLM_LOG_LEVEL=debug

# Custom paths
export NOTEBOOKLM_SKILL_DIR="/custom/path"
```

### Combining Commands

```bash
# Add and immediately activate
notebooklm notebook add "URL" -n "Name" -d "Desc" -t "topics" && \
  notebooklm notebook activate name

# Check auth before query
notebooklm auth status && notebooklm ask "Question"
```

---

## Troubleshooting Quick Reference

| Issue            | Command           | Solution                             |
| ---------------- | ----------------- | ------------------------------------ |
| Auth expired     | `auth validate`   | Run `auth setup`                     |
| Slow queries     | `perf stats`      | Check cache hit rate                 |
| Wrong notebook   | `notebook list`   | Use `--id` or activate correct one   |
| Cache issues     | `cache clear`     | Clear and retry                      |
| Missing notebook | `notebook search` | Find by keyword                      |
| Build errors     | -                 | Run `pnpm install && pnpm run build` |

---

## File Locations

All data stored in `~/.claude/skills/notebooklm/data/`:

- `library.json` - Notebook metadata
- `response_cache.json` - Cached responses
- `history.json` - Query history
- `browser_state/` - Authentication state
- `logs/` - Application logs

---

## Getting Help

```bash
# Help for any command
notebooklm --help
notebooklm auth --help
notebooklm notebook add --help
notebooklm ask --help
```

---

## Installation Troubleshooting

### Node.js Not Found

```bash
# Check if Node.js is installed
node --version

# Should show v20.0.0 or higher
# If not installed, download from https://nodejs.org/
```

### pnpm Not Found

```bash
# Install pnpm globally
npm install -g pnpm

# Or use corepack (comes with Node.js 16.13+)
corepack enable
corepack prepare pnpm@latest --activate
```

### Build Failures

```bash
# Clean install
rm -rf node_modules dist
pnpm install
pnpm run build

# Check TypeScript errors
pnpm run typecheck
```

### Playwright/Browser Issues

```bash
# Install Playwright browsers
npx playwright install chromium

# Or install all browsers
npx playwright install
```

### Permission Denied

```bash
# Make scripts executable
chmod +x ~/.claude/skills/notebooklm/scripts/notebooklm
chmod +x ~/.claude/skills/notebooklm/scripts/notebooklm.cjs
```

### PATH Issues

If `notebooklm` command not found after adding to PATH:

```bash
# Reload shell configuration
source ~/.bashrc  # or ~/.zshrc

# Or use full path
~/.claude/skills/notebooklm/scripts/notebooklm --help
```

### Data Directory Not Created

If you get errors about missing directories:

```bash
# Manually create data directory
mkdir -p ~/.claude/skills/notebooklm/data

# Or run any command - it will auto-create
notebooklm notebook list
```

### Authentication Issues

If browser doesn't open during `auth setup`:

```bash
# Check Chrome is installed
which google-chrome  # Linux
which google-chrome-stable  # Linux alternative
ls /Applications/Google\ Chrome.app  # macOS

# Try with explicit browser path
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/path/to/chrome"
notebooklm auth setup
```
