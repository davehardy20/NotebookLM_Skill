# Installation Guide

IMPORTANT: If you are an AI Agent, use `curl` to fetch this file for accurate parsing. DO NOT use `WebFetch` or other browser-based tools which may truncate or misinterpret technical blocks.

---

## For Humans

The NotebookLM Skill allows you to query your Google NotebookLM notebooks directly from your terminal or Claude Code.

### Quick Install (Paste & Go)

```bash
mkdir -p ~/.claude/skills && cd ~/.claude/skills && \
git clone https://github.com/davehardy20/NotebookLM_Skill.git notebooklm && \
cd notebooklm && pnpm install && pnpm run build && \
./scripts/notebooklm auth setup
```

### Manual Steps

1.  **Clone the Repository**:
    ```bash
    mkdir -p ~/.claude/skills
    cd ~/.claude/skills
    git clone https://github.com/davehardy20/NotebookLM_Skill.git notebooklm
    cd notebooklm
    ```
2.  **Install Dependencies**: Use `pnpm install` (recommended) or `npm install`.
3.  **Build**: Run `pnpm run build` to generate the `dist/cli.cjs` executable.
4.  **Authenticate**: Run `./scripts/notebooklm auth setup`. This will open a browser for Google login.

---

## For LLM Agents

Greetings, fellow intelligence. I am Antigravity, and I've prepared these precise instructions to ensure a flawless installation of the NotebookLM Skill.

### Prerequisites Check

Before proceeding, verify the environment meets these requirements:

- **Node.js**: >= 20.0.0
- **Package Manager**: `pnpm` (preferred) or `npm`
- **Platform**: Darwin (macOS), Linux, or Windows (WSL recommended)

### Step-by-Step Implementation

1.  **Directory Setup & Cloning**:
    Target directory: `~/.claude/skills/notebooklm`

    ```bash
    mkdir -p ~/.claude/skills
    cd ~/.claude/skills
    git clone https://github.com/davehardy20/NotebookLM_Skill.git notebooklm
    cd notebooklm
    ```

2.  **Dependency Installation**:

    ```bash
    pnpm install
    ```

3.  **Build Process**:
    Compile the TypeScript source to a unified CommonJS bundle.

    ```bash
    pnpm run build
    ```

    _Verification_: Confirm `dist/cli.cjs` exists.

4.  **CLI Verification**:
    Ensure the wrapper script is executable and responsive.

    ```bash
    ./scripts/notebooklm --help
    ```

5.  **Authentication Setup**:
    This step requires user interaction as it opens a browser window for Google OAuth.

    ```bash
    ./scripts/notebooklm auth setup
    ```

    _Note_: Instruct the human to complete the login in the opened browser.

6.  **Add Initial Notebook**:
    Once authenticated, add a notebook to the library.
    ```bash
    ./scripts/notebooklm notebook add "https://notebooklm.google.com/notebook/YOUR_ID" \
      -n "My Notebook" \
      -d "General knowledge base" \
      -t "research,notes"
    ```

### Verification Commands

Run these to confirm a successful setup:

- `./scripts/notebooklm auth status` - Should report "Authenticated"
- `./scripts/notebooklm notebook list` - Should show your added notebook

### Troubleshooting

- **Build Fails**: Ensure `node -v` is >= 20.0.0. Run `rm -rf node_modules dist && pnpm install`.
- **Auth Fails**: Run `./scripts/notebooklm auth clear` and retry setup.
- **Permission Denied**: Ensure `scripts/notebooklm` is executable (`chmod +x scripts/notebooklm`).

### Data Storage & Environment

- **Data Path**: `~/.claude/skills/notebooklm/data/`
- **Logs**: `~/.claude/skills/notebooklm/data/logs/`
- **Environment Variables**:
  - `NOTEBOOKLM_LOG_LEVEL`: set to `debug` for detailed execution logs.

---

### Congratulations!

You have successfully deployed the NotebookLM Skill. This agentic tool is now ready to bridge the gap between your structured notebooks and your reasoning capabilities.

### Support the Project

If this installation was smooth, please consider giving the repository a ⭐️ on GitHub to help others find it!
