# NotebookLM CLI Command Reference

Complete guide to installing and using the `notebooklm` CLI with practical examples.

## Installation

### Prerequisites

- **Node.js** >= 20.0.0
- **bun** (recommended) or npm
- **Google Chrome** - For CDP authentication method

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
# Install dependencies with bun
bun install

# Or with npm
npm install
```

### Step 3: Build the Project

```bash
# Build the TypeScript project
bun run build

# This creates the compiled CLI in dist/cli.cjs
# If Bun is installed, `npm install` or `bun install` can also compile
# a native `bin/notebooklm` binary while keeping the Node.js wrapper fallback.
```

### Step 4: Verify Installation

```bash
# Check CLI is working
notebooklm --help

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

#### Option A: Authenticate using Chrome DevTools Protocol (CDP)

```bash
# 1. Start Chrome with remote debugging (in a separate terminal)
# macOS:
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Linux:
google-chrome --remote-debugging-port=9222

# Windows:
"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222

# 2. Log in to NotebookLM in Chrome at https://notebooklm.google.com

# 3. Run authentication
notebooklm auth login

# 4. Verify authentication
notebooklm auth status
```

#### Option B: Import cookies from file

```bash
# 1. Export cookies from Chrome using a browser extension (e.g., "Get cookies.txt")
# 2. Import them
notebooklm auth import --file cookies.txt

# 3. Verify authentication
notebooklm auth status

# 4. Add your first notebook
notebooklm notebook add \
  "https://notebooklm.google.com/notebook/YOUR_NOTEBOOK_ID" \
  -n "My First Notebook" \
  -d "Description of your notebook" \
  -t "topic1,topic2"

# 5. List notebooks to verify
notebooklm notebook list
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
bun install
bun run build
```

---

## Quick Reference

```bash
# Authentication
notebooklm auth login|import|status|validate|clear

# Notebook Management
notebooklm notebook add|list|search|activate|remove|stats

# Queries
notebooklm ask "question" [--id ID] [--url URL] [--save]

# Cache & Performance
notebooklm cache stats|clear|clean
notebooklm perf stats|report

# History
notebooklm history [--stats] [--export] [--clear]
```

---

## Authentication Commands (`auth`)

### `auth login`

Authenticate using Chrome DevTools Protocol (CDP). Extracts cookies from a running Chrome instance.

**Prerequisites:**

- Chrome must be running with remote debugging enabled
- You must be logged in to NotebookLM in Chrome

```bash
# Start Chrome with remote debugging first
chrome --remote-debugging-port=9222

# Then authenticate
notebooklm auth login

# Use custom port
notebooklm auth login --port 9223
```

**What it does:**

1. Connects to Chrome via CDP on the specified port (default: 9222)
2. Navigates to NotebookLM
3. Extracts authentication cookies
4. Validates the session
5. Saves encrypted authentication data

---

### `auth import`

Import authentication cookies from a file (Netscape cookies.txt or JSON format).

```bash
# Import from Netscape cookies.txt format
notebooklm auth import --file cookies.txt

# View help
notebooklm auth import --help
```

**Exporting cookies from Chrome:**

1. Install a cookie export extension (e.g., "Get cookies.txt")
2. Go to <https://notebooklm.google.com>
3. Export cookies to a file
4. Import with the command above

---

### `auth status`

Check current authentication state.

```bash
# Quick status check
notebooklm auth status

# Output example:
# ✓ Authentication Status: Authenticated
# Session age: 2.3 hours ago
# Expires in: 27 days
```

---

### `auth validate`

Test if stored authentication is still valid.

```bash
# Verify auth is working
notebooklm auth validate
```

**When to use:** Before long sessions, if you suspect auth expired.

---

### `auth clear`

Remove all authentication data.

```bash
# Clear auth completely
notebooklm auth clear
```

**When to use:** Troubleshooting, privacy concerns, switching accounts.

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

# Save conversation to history
notebooklm ask "Important question" --save

# Combine options
notebooklm ask "Complex query" \
  --id python-guide \
  --save
```

**Best Practices:**

- Be specific in your questions
- Include context ("In the API documentation...")
- Use `--save` for important queries you want to reference later

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
# 1. Start Chrome with remote debugging (in separate terminal)
chrome --remote-debugging-port=9222

# 2. Authenticate via CDP
notebooklm auth login

# 3. Or import cookies
# notebooklm auth import --file cookies.txt

# 4. Check status
notebooklm auth status

# 5. Add your first notebook
notebooklm notebook add "URL" -n "Name" -d "Description" -t "topics"

# 6. Verify
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

| Issue            | Command           | Solution                                         |
| ---------------- | ----------------- | ------------------------------------------------ |
| Auth expired     | `auth validate`   | Run `auth login` or `auth import`                |
| Chrome not found | -                 | Start Chrome with `--remote-debugging-port=9222` |
| Slow queries     | `perf stats`      | Check cache hit rate                             |
| Wrong notebook   | `notebook list`   | Use `--id` or activate correct one               |
| Cache issues     | `cache clear`     | Clear and retry                                  |
| Missing notebook | `notebook search` | Find by keyword                                  |
| Build errors     | -                 | Run `bun install && bun run build`               |

---

## File Locations

All data stored in `~/.claude/skills/notebooklm/data/`:

- `library.json` - Notebook metadata
- `response_cache.json` - Cached responses
- `history.json` - Query history
- `auth.json` - Encrypted authentication data
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

### Bun Not Found

```bash
# Install bun globally
curl -fsSL https://bun.sh/install | bash

# Or on macOS with Homebrew
brew install oven-sh/bun/bun
```

### Build Failures

```bash
# Clean install
rm -rf node_modules dist
bun install
bun run build

# Check TypeScript errors
bun run typecheck
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

If authentication fails:

**For CDP authentication:**

```bash
# Check Chrome is running with remote debugging
curl http://localhost:9222/json/version

# Should return Chrome version info. If not, start Chrome:
chrome --remote-debugging-port=9222
```

**For cookie import:**

```bash
# Verify cookie file format
head -5 cookies.txt

# Should show Netscape format:
# # Netscape HTTP Cookie File
# .notebooklm.google.com TRUE / FALSE ...
```
