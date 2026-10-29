# Code Challenge Analyzer — Design & Delivery Document

## Overview

The Code Challenge Analyzer presents a candidate with a problem statement and working-but-suboptimal code, then records and evaluates how they improve it. It is a web application: Node.js and Express on the server, SQLite for storage, and a vanilla JavaScript front end served from the same origin.

The distinguishing feature is not code execution. It is the analysis layer: an immutable baseline of the starting code, a line-level diff against every submission, a run-by-run timeline, and a structured improvement summary for the reviewer.

| Acceptance criterion | Status | Where it lives |
| --- | --- | --- |
| 1. Preloaded problem + code | Built | `data/problems.js`, `GET /api/problems/:id` |
| 2. Code editing & execution | Built | CodeMirror editor, `runner/execute.js` |
| 3. Improvement tracking | Built | `analysis/diff.js`, `GET /api/sessions/:id/history` |
| 4. Evaluation of approach | Built | Review page: metrics, timeline, diff |
| 5. Output & submission | Built | `POST /api/sessions/:id/submit`, `submissions` table |

Two capabilities beyond the original specification were added: authenticated candidate and reviewer roles, and a hardened execution environment with process isolation and resource limits.

## Architecture

Four components. The browser talks only to the API server; nothing else is reachable from outside.

| Component | Responsibility | Implementation |
| --- | --- | --- |
| Editor page | Candidate writes and runs code | `public/index.html`, CodeMirror 5 via CDN |
| API server | Request handling, validation, authorisation | Express, `server.js` |
| Runner | Executes candidate code, grades against test cases | `runner/execute.js`, Node `child_process` |
| Database | Users, sessions, submissions, change history | SQLite via `better-sqlite3` |

### What happens on Run

1. The browser POSTs `{sessionId, problemId, code}` to `/api/submissions`.
2. The API server validates the fields, confirms the problem exists, confirms the session exists and belongs to the authenticated user, and confirms it has not been submitted.
3. The Runner writes the code to a file in a fresh temporary directory, spawns the interpreter as a separate OS process, writes the test case input to its stdin, and captures stdout, stderr and exit code.
4. Results are compared against the expected outputs, the submission row is written, and the response returns the per-case results and the running count of executions.

The Database receives a write on every run but is only read back at review time. That asymmetry is deliberate: history accumulates continuously so the reviewer can reconstruct the candidate's approach afterwards.

### Why Node rather than Spring Boot

Spring Boot was considered first. It was rejected because the work it adds — JVM build tooling, JPA mappings, dependency injection configuration — is unrelated to the problem being solved, and the execution model is identical either way: the server spawns an OS process and reads its output. Node reaches the same result with less scaffolding, and serves the front end from the same origin, which removes cross-origin configuration entirely.

## Data model

Three application tables plus one owned by the session store.

| Table | Holds | Key columns |
| --- | --- | --- |
| `users` | Accounts and roles | `username` (unique), `password_hash`, `role` |
| `challenge_sessions` | One candidate working one problem | `id` (UUID), `user_id`, `original_code`, `submitted_at` |
| `submissions` | One execution run | `session_id`, `code`, `passed`, `total`, `created_at` |
| `login_sessions` | Express session store | managed by `better-sqlite3-session-store` |

A challenge session has many submissions. That one-to-many relationship is what makes improvement tracking possible: count the rows for a session and you have the run count; order them by time and you have the approach evolution.

### The starting code is stored twice

`problems.js` holds `starterCode`, which is loaded into the editor and overwritten as soon as the candidate types. When a session is created, that same code is copied into `challenge_sessions.original_code` and never modified again.

This looks redundant and is not. A diff requires a fixed reference point. Once the working copy has been edited, the starting state is gone — there is nothing left to compare against. Storing an immutable baseline alongside the mutable working copy costs a few hundred bytes and is the single decision that makes criterion 3 achievable.

### Session ownership

`challenge_sessions.user_id` records which candidate owns the session. Every write to a session checks it. Without this column, any authenticated candidate could submit code into another candidate's session by guessing its UUID — authentication alone does not answer the question of what belongs to whom.

### Naming

The application's own sessions are named `challenge_sessions` rather than `sessions`, because the Express session store claims the latter name for login state. See Design decisions for how this was discovered.

## API reference

All endpoints return JSON. Authentication is a `httpOnly` session cookie; the browser attaches it automatically.

| Method | Path | Access | Returns |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Public | `{user}` or 401 |
| POST | `/api/auth/logout` | Public | `{ok}` |
| GET | `/api/auth/me` | Public | `{user}` or 401 |
| GET | `/api/problems` | Authenticated | Summary list: id, title, language |
| GET | `/api/problems/:id` | Authenticated | Full problem, test cases removed |
| POST | `/api/sessions` | Authenticated | `{sessionId, problemId}` |
| POST | `/api/submissions` | Authenticated, owner | `{submissionId, runCount, passed, total, results}` |
| POST | `/api/sessions/:id/submit` | Authenticated, owner | `{submitted, submittedAt}` |
| GET | `/api/sessions` | Reviewer only | All sessions with run counts and status |
| GET | `/api/sessions/:id/history` | Reviewer only | Timeline, diff, original and final code |

### Test cases never reach the client

`GET /api/problems/:id` strips `testCases` from the payload before responding. Anything the server sends is visible in the browser's network tab, so a candidate who could read the expected outputs could print them directly and pass every case without solving the problem. Grading is performed server-side against data the client never receives.

### Status codes

The distinction between 401, 403 and 409 is load-bearing. 401 means the caller is unidentified and should log in. 403 means the caller is known and not permitted — logging in again will not help. 409 means the request is well-formed but the resource state forbids it, which is what a run against an already-submitted session returns.

### Error responses

Unhandled exceptions return `{"error": "Internal server error"}` with no stack trace. Full detail is written to the server log. Malformed JSON returns a 400 rather than an HTML error page. This was added after a deliberately malformed request returned a stack trace containing absolute file paths and the project's dependency layout.

## Execution model

Candidate code exists as a string in server memory. Interpreters run files, not strings, so every execution follows four steps:

1. **Create.** `fs.mkdtempSync` makes a fresh temporary directory; the code is written into it as a source file.
2. **Invoke.** `spawn` launches the interpreter as a separate OS process with that directory as its working directory.
3. **Capture.** The test case input is written to the process's stdin and closed; stdout, stderr and the exit code are collected.
4. **Clean up.** The directory and everything in it is removed, on both the success and error paths.

Arguments are passed to `spawn` as an array rather than a shell string, so there is no shell to interpret metacharacters and no command injection surface.

### The stdin/stdout contract

A test case is a pair: input written to the process, expected output compared against what it prints. This is why starter code reads from standard input rather than hardcoding values — a program that ignores stdin produces identical output for every case, so every test either always passes or always fails.

The same contract works for all four target languages, which is what makes the language pipeline a configuration table rather than four separate implementations.

### Grading

A case passes when the trimmed output matches the trimmed expectation **and** the exit code is zero. Both halves matter. Trailing newlines make visually identical strings unequal, and a program can print the right answer and then crash — correct output from a failed process is not a pass.

Cases run sequentially rather than in parallel, so one submission never holds more than one process open.

### Limits

| Limit | Value | Prevents |
| --- | --- | --- |
| Wall-clock timeout | 5 seconds, `SIGKILL` | Infinite loops |
| Output cap | 100 KB | Unbounded stdout filling the disk |
| Code length cap | 50 KB | Oversized payloads reaching the interpreter |

`SIGKILL` is used rather than the default `SIGTERM` because `SIGTERM` can be caught and ignored in a few lines of candidate code, which would defeat the timeout entirely. `SIGKILL` cannot be caught, blocked or ignored.

## Multi-language support

> **Status: designed, not yet implemented.** Python is the only language currently executing. This section describes the intended design. Do not circulate this document until the section is either built or rewritten to say so.

The Runner's four steps are language-independent. Interpreted and compiled languages differ in exactly one respect: compiled languages need a build step before execution, and a build failure must be reported as a distinct outcome from a test failure.

The pipeline is therefore a configuration table rather than four implementations.

| Language | Source file | Compile step | Run command |
| --- | --- | --- | --- |
| Python | `solution.py` | none | `python -I -B solution.py` |
| Java | `Solution.java` | `javac Solution.java` | `java Solution` |
| C | `solution.c` | `gcc solution.c -o solution` | `./solution` |
| C++ | `solution.cpp` | `g++ solution.cpp -o solution` | `./solution` |

Adding a language means adding a row, a starter-code sample, and the matching CodeMirror syntax mode. The `clike` mode covers C, C++ and Java.

### Compile failures

A compilation failure is reported as a build error with the compiler's stderr attached, not as a failed test case. A candidate whose code does not compile has produced a different kind of result from one whose logic is wrong, and the review page should distinguish them.

### Toolchain dependency

This is the part that carries delivery risk. Python requires no toolchain. Java requires a JDK on the host. C and C++ require gcc, which on Windows means installing MSYS2 or MinGW and adding it to the system PATH.

This is a host-configuration dependency rather than an application one, and it reinforces the containerisation argument in the security section: a container image with a known toolchain removes the question entirely.

## Authentication and authorisation

Two roles: candidate and reviewer.

### Passwords

Passwords are hashed with bcrypt at cost factor 10 and never stored in recoverable form. Login hashes the attempt and compares hashes. A database disclosure does not disclose passwords.

The cost factor makes each hash take roughly 100 ms — imperceptible to a user, prohibitive for an attacker testing millions of candidates.

### Timing

When a username does not exist, the code still performs a bcrypt comparison against a dummy hash before returning failure. Without this, a nonexistent username would fail instantly while a wrong password took 100 ms, and an attacker timing responses could enumerate valid usernames. Both paths now take the same time.

Both failure modes also return the same message — "Invalid username or password" — for the same reason.

### Sessions

Login state is a server-side session referenced by an `httpOnly` cookie, so page JavaScript cannot read it and a script injection cannot steal it. Sessions are stored in SQLite and survive a server restart.

**Only the user id is stored in the session.** The role is read fresh from the database on every request. Storing the role in the session would mean a permission change did not take effect until the user logged out, and would make the role forgeable if session handling were ever compromised.

### Three layers

| Middleware | Question answered | Failure |
| --- | --- | --- |
| `attachUser` | Who is this? | sets `req.user` to null |
| `requireAuth` | Are they logged in? | 401 |
| `requireRole` | Are they permitted? | 403 |

Ownership is a fourth, separate check: `session.user_id !== req.user.id` returns 403 even for a correctly authenticated candidate. Authentication establishes identity; authorisation establishes entitlement; ownership establishes what belongs to whom. They are three different questions and each is answered independently.

## Security analysis

### Threat model

The attacker is a candidate who fully controls the code submitted for execution. That code runs as a real operating-system process under the account running the server. Anything that account can do, the candidate's code can do.

A secondary attacker is a candidate attempting to reach another candidate's work, or to reach reviewer-only data.

### Implemented mitigations

| Mitigation | Prevents |
| --- | --- |
| Fresh temp directory per run, set as working directory | One run reading or overwriting another's files |
| Guaranteed cleanup on success and error paths | Disk accumulation |
| 5-second timeout, `SIGKILL` | Infinite loops; uncatchable so it cannot be defeated |
| 100 KB output cap, process killed on breach | Unbounded stdout filling the disk |
| 50 KB code cap, checked before spawn | Oversized payloads |
| Environment stripped to `PATH` and `SYSTEMROOT` | Child inheriting host secrets and configuration |
| Python `-I` isolated mode | Shadowing standard modules via user site packages |
| Arguments passed as an array, no shell | Command injection |
| Parameterised SQL throughout | SQL injection |
| HTML escaping of all candidate-supplied content | Stored XSS against the reviewer |
| Test cases withheld from client payloads | Candidates reading expected outputs |
| bcrypt hashing, uniform failure timing and messages | Password disclosure, username enumeration |
| `httpOnly` session cookie, role read per request | Cookie theft via script, stale privileges |
| Server-side ownership and role checks on every endpoint | Cross-candidate and cross-role access |

The XSS mitigation matters twice over: candidate code and its output are rendered in the reviewer's browser, so an unescaped payload would execute in a higher-privileged user's session having been stored in the database first.

### Residual risk

The following are **not** mitigated and are known:

- Code runs as the host user. `import os` followed by a destructive filesystem call on an absolute path outside the temp directory would succeed.
- No network restriction. Submitted code can make outbound connections.
- No memory limit. A large allocation can exhaust host memory inside the timeout window.
- No CPU or process limit. Code can spawn subprocesses; on Windows these may outlive the parent kill.
- No concurrency control. Many simultaneous submissions could exhaust host resources.
- Interpreter resolution depends on host PATH, which varies by machine.

### Production requirements

One container per execution, with `--network none`, a read-only filesystem, memory and CPU caps, a non-privileged user inside the container, a pinned toolchain image, and a job queue bounding concurrent executions.

### Why the work stopped here

Containerisation was assessed and deliberately deferred. The project ran on a fixed timeline with a single developer; the available effort was spent on mitigations that could be implemented and verified, and the residual risk is documented above rather than left implicit. The system as delivered is suitable for a controlled demonstration environment and is not suitable for untrusted public use.

## Front end

Plain HTML, CSS and JavaScript, served by Express from `public/`. No build step and no framework.

This was chosen deliberately. A framework would have introduced a build pipeline, a separate dev server port, and cross-origin configuration — three costs, none of which buy anything the specification asks for. Serving the front end from the same origin as the API removes all three.

| Page | Role | Shows |
| --- | --- | --- |
| `login.html` | Public | Credentials; redirects by role on success |
| `index.html` | Candidate | Problem list, editor, Run, Submit, results |
| `reviewer.html` | Reviewer | All sessions with run counts and status |
| `review.html` | Reviewer | Metrics, run timeline, side-by-side diff |

### Editor

CodeMirror 5, loaded from a CDN. Version 5 rather than 6 is deliberate: CodeMirror 6 assumes a bundler, and adding a bundler would undo the no-build-step decision above.

### Diff rendering

The diff is computed on the server and returned as structured JSON — an array of lines, each tagged added, removed or unchanged. The browser renders those tags as coloured rows.

The split matters: the server decides what changed, the browser decides what it looks like. The change history has to be stored regardless, so computing it server-side costs nothing extra and means a different client could render the same data.

### The enforcement split

The front end redirects a user away from a page meant for the other role. This is a convenience, not a security control — a determined user can open `reviewer.html` directly.

That page would be empty. Every endpoint behind it returns 403. **The front end tidies the experience; the server enforces access.** The same principle applies to the countdown timer: the deadline is issued by the server, and disabling the buttons when it expires is cosmetic — the server rejects late submissions independently.

## Design decisions and findings

Four issues found during implementation, each with its cause and resolution.

### Table name collision

**Symptom.** Login succeeded, then every subsequent request reported the user as unauthenticated. The session store failed with a column count mismatch.

**Cause.** "Session" meant two different things in this system — a candidate's work session and an authenticated browser session. Both claimed the table name `sessions`. The Express session store found an existing table it had not created, with entirely different columns, and SQLite accepted it until the first write.

**Resolution.** Renamed to `challenge_sessions` and `login_sessions`. Two distinct domain concepts need two distinct names; the collision was invisible until a third-party library assumed the generic name was its own.

### Interpreter resolution

**Symptom.** On a rebuilt machine, every test case timed out. Captured output read "Downloading... Extracting...".

**Cause.** Windows ships an App Execution Alias that intercepts `python` and opens the Microsoft Store. The shell resolved `python` to the real interpreter; the spawned child, with its deliberately stripped `PATH`, resolved it to the stub.

**Resolution.** Disabled the alias. Notably, the hardening caused the divergence and the timeout caught it cleanly — the server reported a structured timeout rather than hanging. This is the second independent argument for a pinned interpreter path or a container image.

### Schema evolution

**Symptom.** Repeated "no such column" errors after schema changes.

**Cause.** `CREATE TABLE IF NOT EXISTS` leaves an existing table untouched. Changing the statement has no effect on a database that already exists.

**Resolution.** During development, the database file is deleted and recreated. This is a known limitation: a production system requires versioned migrations that alter tables without destroying data.

### A test that could not fail

**Symptom.** The authentication test script reported a pass while the server was not running.

**Cause.** The test asserted that a request after logout threw an exception. A stopped server also throws. The test could not distinguish "correctly rejected" from "nothing there".

**Resolution.** The assertion now checks for an explicit 401 status. A test that passes when the system is absent is worse than no test, because it reports confidence it has not earned.

## Known limitations

Stated plainly. Each is a decision with a reason, not an oversight.

| Limitation | Consequence | What would resolve it |
| --- | --- | --- |
| No execution sandbox | Submitted code runs with host user privileges | Container per execution |
| Python only at present | Java, C, C++ designed but not built | Sessions remaining in the plan |
| No schema migrations | Schema changes require recreating the database | Versioned migration scripts |
| Seeded demo accounts | Known passwords in source | Provisioned accounts, forced password change |
| Session secret in source | Sessions forgeable if source is disclosed | Secret from environment configuration |
| Single SQLite file | Limited concurrent write throughput | PostgreSQL for multi-user deployment |
| No concurrency limit on executions | Many simultaneous runs could exhaust the host | Job queue with bounded workers |
| Deadline enforced per session only | No global exam window | Scheduling layer |
| No pagination on the reviewer list | Degrades with large session counts | Server-side paging |

### Dependency audit

`npm audit` reports findings against the installed dependency tree. These were reviewed rather than auto-fixed: `npm audit fix` can advance packages across major versions, and an unreviewed upgrade close to delivery carries more risk than the findings themselves in a locally-run demonstration. The findings and this reasoning should be recorded before handover.

### Scope decisions

Two features in the original specification were reconsidered during implementation. Multi-language support was deferred behind the analysis features, on the reasoning that the specification's four-language requirement assumed an existing IDE that did not exist, while criteria 3 and 4 are what distinguish this system from a code runner. Authentication was added despite not appearing in the specification, because the two-role workflow it describes is not demonstrable without it.

## Setup and verification

### Prerequisites

Node.js LTS, Python 3, Git. On Windows, Python must be added to PATH during installation, and the Microsoft Store App Execution Aliases for `python.exe` and `python3.exe` must be disabled.

### Running

```
git clone <repository url>
cd code-challenge-analyzer
npm install
npm run dev
```

The server listens on `http://localhost:3000`. The database is created and seeded with demo accounts on first start.

### Demo accounts

| Role | Username | Password |
| --- | --- | --- |
| Candidate | `candidate` | `candidate123` |
| Reviewer | `reviewer` | `reviewer123` |

These are seeded for demonstration. See Known limitations.

### Verification

`test.ps1` exercises the API end to end without the browser: login, session creation, two submissions, a candidate's blocked access to reviewer data, and a reviewer's successful read of the same data.

Expected output:

```
Logged in as: Dhanapal M
Session: <uuid>
Run 1 passed: 2 of 3
Run 2 passed: 3 of 3
Candidate blocked from history - status: 403
Reviewer sees run count: 2 lines changed: 17
```

The script is also a regression suite: run it after any change to confirm nothing server-side has broken.

### Demonstration sequence

1. Sign in as the candidate and open the palindrome problem. The editor loads with working but inefficient code — it builds a reversed string character by character.
2. Run it unchanged. All three cases pass; the code is correct and poor.
3. Replace it with a two-line slice-based solution and run again. All three cases still pass.
4. **This is the point of the system.** Correctness alone cannot distinguish the two versions. The diff can.
5. Sign in as the reviewer in a separate browser window. Open the session: run count, lines changed, score per run, and the before-and-after diff.
6. Attempt to open the reviewer page as the candidate. The page loads and stays empty, because the API returns 403.
