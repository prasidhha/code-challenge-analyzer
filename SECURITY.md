Threat model — two or three sentences. The attacker is a candidate submitting arbitrary Python. They fully control the code that runs. The Runner executes it as a real OS process, so anything your Windows user account can do, their code can do.

Implemented mitigations — one line each, saying what it stops:

Per-run temp directory via mkdtempSync, with cwd set to it — one run can't see another's files
Guaranteed cleanup in rmSync on both close and error paths — no accumulation on disk
5-second wall-clock timeout with SIGKILL — SIGKILL specifically, because Python can catch and ignore softer signals
100 KB output cap, killed on breach — stops while True: print("x") filling the disk
50 KB code-length cap — rejects oversized payloads before spawning anything
Stripped environment, only PATH and SYSTEMROOT — child no longer inherits your machine's variables
Python -I isolated mode — ignores user site packages, so standard modules can't be shadowed
child.on('error') handler — a missing interpreter returns a result instead of crashing the server

Known limitations — be specific, not vague. Vague reads as unaware:

Code runs as the host user. import os and shutil.rmtree on a path outside the temp directory would succeed
No network restriction — code can make outbound HTTP requests
No memory limit — a large allocation can exhaust host RAM within the timeout window
No CPU or process limit — code can spawn subprocesses that outlive the parent kill
No concurrency control — many simultaneous submissions could exhaust the host

Production requirements — the remedy for each gap above:

One container per execution, --network none, read-only filesystem
Memory and CPU caps at the container level
Non-privileged user inside the container
A job queue capping concurrent executions