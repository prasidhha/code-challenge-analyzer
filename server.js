const problems = require('./data/problems');
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