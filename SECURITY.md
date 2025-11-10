# Security Checklist for Public Repository

## ✅ Completed Security Measures

### Environment Variables
- [x] Created `.gitignore` at root level
- [x] Added `.env` to `.gitignore`
- [x] Added `.env.local` to `.gitignore`
- [x] Added `.env.*.local` to `.gitignore`
- [x] Created `agent/.env.example` with placeholder values
- [x] Created `frontend/.env.example` with safe defaults
- [x] Verified actual `.env` files are ignored by git

### Database & Data Files
- [x] Added `*.db` to `.gitignore`
- [x] Added `*.db-journal` to `.gitignore`
- [x] Added `agent/agent_histories/` to `.gitignore`
- [x] Verified `backend/data/unit.db` is ignored

### API Keys & Secrets
- [x] No real API keys in committed files
- [x] Only placeholder keys in `.env.example` files
- [x] OpenAI API key is in `.env` (ignored)
- [x] No hardcoded secrets in source code

### Python & Node
- [x] Added `__pycache__/` to `.gitignore`
- [x] Added `node_modules/` to `.gitignore`
- [x] Added `venv/` and virtual environment folders
- [x] Added `.next/` build directory

### IDE & OS Files
- [x] Added `.vscode/` to `.gitignore`
- [x] Added `.DS_Store` to `.gitignore`
- [x] Added IDE-specific files

## Setup Instructions for New Contributors

### 1. Clone Repository
```bash
git clone <repo-url>
cd unit
```

### 2. Set Up Environment Variables

**Agent (.env):**
```bash
cd agent
cp .env.example .env
# Edit .env and add your OpenAI API key
```

**Frontend (.env.local):**
```bash
cd frontend
cp .env.example .env.local
# Defaults should work, but adjust if needed
```

### 3. Never Commit Secrets
- Always use `.env.example` as a template
- Never commit actual `.env` files
- If you accidentally commit a secret:
  1. Immediately revoke/rotate the key
  2. Remove from git history using `git filter-branch` or BFG Repo-Cleaner
  3. Force push (if working on a branch)

## Files Excluded from Git

### Environment Files
- `agent/.env`
- `frontend/.env.local`
- Any `.env.*` files

### Data Files
- `backend/data/*.db`
- `agent/agent_histories/*.json`
- Any `*.db` or `*.sqlite` files

### Build & Cache
- `node_modules/`
- `__pycache__/`
- `.next/`
- `venv/`, `env/`, `.venv/`

### IDE & OS
- `.vscode/`
- `.DS_Store`
- `*.swp`, `*.swo`

## Pre-Commit Checklist

Before committing, always verify:

```bash
# Check git status
git status

# Verify no .env files are staged
git status | grep ".env"

# Search for potential secrets in staged changes
git diff --cached | grep -i "sk-proj-"
git diff --cached | grep -i "api[_-]key"

# Check what's being ignored
git status --ignored | grep -E "\.env|\.db|agent_histories"
```

## Emergency: Secret Committed

If you accidentally commit a secret:

1. **Immediately revoke the secret**
   - For OpenAI: https://platform.openai.com/api-keys

2. **Remove from git history**
   ```bash
   # Using BFG Repo-Cleaner (recommended)
   bfg --replace-text passwords.txt
   
   # Or using git filter-branch
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch path/to/file" \
     --prune-empty --tag-name-filter cat -- --all
   ```

3. **Force push (if already pushed)**
   ```bash
   git push --force --all
   ```

4. **Notify team members** to rebase their branches

## Verification Commands

Run these before making the repository public:

```bash
# Check for common secret patterns
git grep -i "api[_-]key" -- . ':!*.example' ':!SECURITY.md'
git grep -i "sk-proj-" -- . ':!*.example' ':!SECURITY.md'
git grep -i "password" -- . ':!*.example' ':!SECURITY.md'

# Verify .env files are ignored
git check-ignore agent/.env frontend/.env.local

# Check staging area
git ls-files | grep -E "\.env$|\.db$"
```

All commands should return empty or confirm files are ignored.
