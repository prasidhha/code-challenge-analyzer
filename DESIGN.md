1. Architecture — the four components, what each owns, how a run flows through them.

2. Data model — the problem object's fields. Why originalCode is stored separately from starterCode. Why sessionId exists at all.

3. API surface — your four endpoints, method and path, what each returns. Why testCases never reaches the client.

4. Execution model — the four Runner steps. How stdin and stdout carry test data. Why comparison trims whitespace and checks exit code.

5. Error handling — the three failure signatures you've met: server not running, server threw, validation rejected. Why the error handler takes four arguments.

6. Security — link to SECURITY.md, summarise in three lines.

7. Known limitations — single language so far, in-memory storage, no sandbox, no concurrency control.