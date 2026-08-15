const problems = require('./data/problems');
const { runTests } = require('./runner/execute');
const express = require('express');
const app = express();

app.use(express.json());

const { createSession, getSession, addSubmission, getBySession } = require('./data/submissions');

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'code-challenge-analyzer' });
});

app.get('/api/problems', (req, res) => {
  const list = problems.map(p => ({
    id: p.id,
    title: p.title,
    language: p.language
  }));
  res.json(list);
});

app.get('/api/problems/:id', (req, res) => {
  const id = Number(req.params.id);
  const problem = problems.find(p => p.id === id);

  if (!problem) {
    return res.status(404).json({ error: 'Problem not found' });
  }

  const { testCases, ...safe } = problem;
  res.json(safe);
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});

const crypto = require('crypto');

app.post('/api/sessions', (req, res) => {
  const problemId = Number(req.body.problemId);
  const problem = problems.find(p => p.id === problemId);
  if (!problem) return res.status(404).json({ error: 'Problem not found' });

  const sessionId = crypto.randomUUID();
  createSession(sessionId, problem.id, problem.starterCode);
  res.status(201).json({ sessionId, problemId: problem.id });
});

app.post('/api/submissions', async (req, res) => {
  const { sessionId, problemId, code } = req.body;

  if (!sessionId || !problemId || typeof code !== 'string') {
    return res.status(400).json({ error: 'sessionId, problemId and code are required' });
  }

  const problem = problems.find(p => p.id === Number(problemId));
  if (!problem) {
    return res.status(404).json({ error: 'Problem not found' });
  }

  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const testRun = await runTests(code, problem.testCases);
  const saved = addSubmission({
    sessionId, problemId: problem.id, code,
    passed: testRun.passed, total: testRun.total
  });
  const runCount = getBySession(sessionId).length;

  res.status(201).json({
    submissionId: saved.id, runCount,
    passed: testRun.passed, total: testRun.total,
    results: testRun.results
  });
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const { computeDiff } = require('./analysis/diff');

app.get('/api/sessions/:id/history', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const submissions = getBySession(session.id);
  const latest = submissions[submissions.length - 1];

  const timeline = submissions.map((s, i) => ({
    submissionId: s.id,
    runNumber: i + 1,
    passed: s.passed,
    total: s.total,
    createdAt: s.created_at,
    changedFromOriginal: computeDiff(session.original_code, s.code).changed
  }));

  res.json({
    sessionId: session.id,
    runCount: submissions.length,
    originalCode: session.original_code,
    finalCode: latest ? latest.code : session.original_code,
    diff: latest ? computeDiff(session.original_code, latest.code) : null,
    timeline
  });
});