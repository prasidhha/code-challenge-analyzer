const submissions = [];
let nextId = 1;

function addSubmission({ sessionId, problemId, code }) {
  const submission = {
    id: nextId++,
    sessionId,
    problemId,
    code,
    createdAt: new Date().toISOString()
  };
  submissions.push(submission);
  return submission;
}

function getBySession(sessionId) {
  return submissions.filter(s => s.sessionId === sessionId);
}

module.exports = { addSubmission, getBySession };