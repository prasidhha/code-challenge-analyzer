const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const TIMEOUT_MS = 5000;

function runPython(code, input) {
  return new Promise((resolve) => {
    const file = path.join(os.tmpdir(), `run_${crypto.randomUUID()}.py`);
    fs.writeFileSync(file, code);

    const child = spawn('python', [file]);

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, TIMEOUT_MS);

    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });

    child.stdin.write(input || '');
    child.stdin.end();

    child.on('close', (exitCode) => {
      clearTimeout(timer);
      fs.unlinkSync(file);
      resolve({
        stdout,
        stderr: timedOut ? 'Execution timed out' : stderr,
        exitCode,
        timedOut
      });
    });
  });
}
async function runTests(code, testCases) {
  const results = [];

  for (const test of testCases) {
    const r = await runPython(code, test.input);
    const actual = r.stdout.trim();
    const expected = test.expectedOutput.trim();

    results.push({
      input: test.input.trim(),
      expected,
      actual,
      passed: actual === expected && r.exitCode === 0,
      error: r.stderr || null
    });
  }

  const passed = results.filter(r => r.passed).length;
  return { results, passed, total: results.length };
}
module.exports = { runPython,runTests };