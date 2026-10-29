# Code Challenge Analyzer

A coding-challenge platform that evaluates **how a candidate improves existing code**, not whether they can solve a problem from scratch.

Candidates receive a problem statement and a working-but-suboptimal solution. They edit, run, and submit. The system records every run, diffs each submission against an immutable baseline, and presents the reviewer with a timeline of the candidate's approach.

## Requirements

- Node.js LTS
- Python 3
- Git

**Windows:** tick *Add Python to PATH* during installation, and disable the Microsoft Store App Execution Aliases for `python.exe` and `python3.exe` under Settings → Apps → Advanced app settings → App execution aliases. Without this, the Runner resolves `python` to a Store stub and every execution times out.

## Running

```
npm install
npm run dev
```

Server starts on http://localhost:3000. The SQLite database is created and seeded on first start.

## Demo accounts

| Role | Username | Password |
| --- | --- | --- |
| Candidate | `candidate` | `candidate123` |
| Reviewer | `reviewer` | `reviewer123` |

Seeded for demonstration only — see [SECURITY.md](SECURITY.md).

## Verifying

```
.\test.ps1
```

Exercises the API end to end without a browser: login, session creation, two submissions, a candidate blocked from reviewer data, and a reviewer reading the same data. Expected:

```
Logged in as: Dhanapal M
Session: <uuid>
Run 1 passed: 2 of 3
Run 2 passed: 3 of 3
Candidate blocked from history - status: 403
Reviewer sees run count: 2 lines changed: 17
```

Run it after any change — it is the regression suite.

## Layout

```
server.js            Express app, routes, middleware wiring
data/                Problems, database, users, sessions, submissions
runner/execute.js    Code execution and test grading
analysis/diff.js     Line-level diff engine
middleware/auth.js   attachUser, requireAuth, requireRole
public/              Login, candidate view, reviewer views
docs/DESIGN.md       Architecture, data model, API, decisions
SECURITY.md          Threat model, mitigations, residual risk
```

## Documentation

- **[docs/DESIGN.md](docs/DESIGN.md)** — full design and delivery document
- **[SECURITY.md](SECURITY.md)** — security analysis

## Status

Python execution is implemented. Java, C and C++ are designed but not yet built — see the multi-language section of the design document.
