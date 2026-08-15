// To run other code inside a code, this helps to run python from node code
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const TIMEOUT_MS = 5000;
const MAX_OUTPUT = 100 * 1024;
const MAX_CODE_LENGTH = 50 * 1024;

function runPython(code, input) {
  return new Promise((resolve) => {
    if (code.length > MAX_CODE_LENGTH) {
      return resolve({ stdout: '', stderr: 'Code exceeds maximum length', exitCode: 1, timedOut: false });
    }

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccr-'));
    const file = path.join(dir, 'solution.py');
    fs.writeFileSync(file, code);

    const child = spawn('python', ['-I', '-B', file], {
      cwd: dir,
      env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT },
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let killedForOutput = false;

    const cleanup = () => {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, TIMEOUT_MS);

    child.stdout.on('data', d => {
      stdout += d;
      if (stdout.length > MAX_OUTPUT) {
        killedForOutput = true;
        child.kill('SIGKILL');
      }
    });

    child.stderr.on('data', d => {
      if (stderr.length < MAX_OUTPUT) stderr += d;
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      cleanup();
      resolve({ stdout: '', stderr: `Failed to start: ${err.message}`, exitCode: 1, timedOut: false });
    });

    child.stdin.on('error', () => {});
    child.stdin.write(input || '');
    child.stdin.end();

    child.on('close', (exitCode) => {
      clearTimeout(timer);
      cleanup();
      let error = stderr;
      if (timedOut) error = 'Execution timed out';
      if (killedForOutput) error = 'Output limit exceeded';
      resolve({ stdout: stdout.slice(0, MAX_OUTPUT), stderr: error, exitCode, timedOut });
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