const problems = require('./data/problems');
const { runTests } = require('./runner/execute');
const express = require('express');
const app = express();

app.use(express.json());

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

const { addSubmission, getBySession } = require('./data/submissions');
const crypto = require('crypto');

app.post('/api/sessions', (req, res) => {
  res.status(201).json({ sessionId: crypto.randomUUID() });
});

app.post('/api/submissions', async(req, res) => {
  const { sessionId, problemId, code } = req.body;

  if (!sessionId || !problemId || typeof code !== 'string') {
    return res.status(400).json({ error: 'sessionId, problemId and code are required' });
  }

  const problem = problems.find(p => p.id === Number(problemId));
  if (!problem) {
    return res.status(404).json({ error: 'Problem not found' });
  }

  const saved = addSubmission({ sessionId, problemId: problem.id, code });
  const runCount = getBySession(sessionId).length;
  const testRun = await runTests(code, problem.testCases);

  res.status(201).json({
    submissionId: saved.id,
    runCount,
    passed: testRun.passed,
    total: testRun.total,
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