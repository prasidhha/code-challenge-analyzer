# Security

This system executes code written by untrusted users. This document states what that means, what has been done about it, and what has not.

## Threat model

The attacker is a candidate who fully controls the code submitted for execution. That code runs as a real operating-system process under the account running the server. **Anything that account can do, the candidate's code can do.**

A secondary attacker is a candidate attempting to reach another candidate's work, or reviewer-only data.

## Implemented mitigations

### Execution

| Mitigation | Prevents |
| --- | --- |
| Fresh temporary directory per run, set as the process working directory | One run reading or overwriting another's files |
| Guaranteed cleanup on both success and error paths | Disk accumulation |
| 5-second wall-clock timeout, terminated with `SIGKILL` | Infinite loops — `SIGKILL` cannot be caught or ignored, unlike `SIGTERM` |
| 100 KB output cap, process killed on breach | Unbounded stdout filling the disk |
| 50 KB code cap, checked before spawn | Oversized payloads reaching the interpreter |
| Environment stripped to `PATH` and `SYSTEMROOT` | Child process inheriting host secrets and configuration |
| Python `-I` isolated mode | Shadowing standard modules via user site packages |
| Arguments passed to `spawn` as an array, no shell | Command injection |
| `child.on('error')` handler | A missing interpreter crashing the server |

### Application

| Mitigation | Prevents |
| --- | --- |
| Parameterised SQL throughout, no string concatenation | SQL injection |
| HTML escaping of all candidate-supplied content before rendering | Stored XSS against the reviewer |
| Test cases stripped from client payloads | Candidates reading expected outputs and printing them |
| bcrypt hashing at cost factor 10 | Password disclosure on database compromise |
| Dummy bcrypt comparison on unknown usernames | Username enumeration via response timing |
| Identical failure message for bad username and bad password | Username enumeration via response content |
| `httpOnly` session cookie | Cookie theft via injected script |
| Only the user id stored in the session; role read per request | Stale privileges, forged roles |
| Server-side role and ownership checks on every endpoint | Cross-candidate and cross-role access |

The XSS mitigation matters twice over: candidate code and its output are rendered in the **reviewer's** browser, so an unescaped payload would be stored in the database and then execute in a higher-privileged user's session.

Front-end redirects are a convenience, not a control. A candidate can open `reviewer.html` directly; the page loads and stays empty because every endpoint behind it returns 403. The same applies to the countdown timer — the deadline is issued by the server and enforced there.

## Residual risk

The following are **not** mitigated:

- **Code runs as the host user.** A destructive filesystem call on an absolute path outside the temp directory would succeed.
- **No network restriction.** Submitted code can make outbound connections.
- **No memory limit.** A large allocation can exhaust host memory within the timeout window.
- **No CPU or process limit.** Code can spawn subprocesses; on Windows these may outlive the parent kill.
- **No concurrency control.** Many simultaneous submissions could exhaust host resources.
- **Interpreter resolution depends on host PATH**, which varies by machine.
- **Seeded accounts with known passwords**, and a session secret committed in source.

## Production requirements

One container per execution, with:

- `--network none`
- Read-only filesystem
- Memory and CPU caps
- Non-privileged user inside the container
- Pinned toolchain image
- Job queue bounding concurrent executions

Plus provisioned accounts with forced password change, and the session secret supplied from environment configuration rather than source.

## Why the work stopped here

Containerisation was assessed and deliberately deferred. The project ran on a fixed timeline with a single developer; the available effort was spent on mitigations that could be implemented and verified, and the residual risk is documented above rather than left implicit.

**The system as delivered is suitable for a controlled demonstration environment. It is not suitable for untrusted public use.**
