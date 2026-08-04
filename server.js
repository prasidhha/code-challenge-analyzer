const express = require('express');
const app = express();

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'code-challenge-analyzer' });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});