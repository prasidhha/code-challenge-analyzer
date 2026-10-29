const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TIMEOUT_MS = 5000;
const COMPILE_TIMEOUT_MS = 10000;
const MAX_OUTPUT = 100 * 1024;
const MAX_CODE_LENGTH = 50 * 1024;

const LANGUAGES = {
  python: {
    sourceFile: 'solution.py',
    compile: null,
    run: dir => ({ cmd: 'python', args: ['-I', '-B', 'solution.py'] })
  },
  java: {
    sourceFile: 'Solution.java',
    compile: dir => ({ cmd: 'javac', args: ['Solution.java'] }),
    run: dir => ({ cmd: 'java', args: ['-cp', '.', 'Solution'] })
  },
  c: {
    sourceFile: 'solution.c',
    compile: dir => ({ cmd: 'gcc', args: ['solution.c', '-O2', '-o', 'solution'] }),
    run: dir => ({ cmd: path.join(dir, exe('solution')), args: [] })
  },
  cpp: {
    sourceFile: 'solution.cpp',
    compile: dir => ({ cmd: 'g++', args: ['solution.cpp', '-O2', '-o', 'solution'] }),
    run: dir => ({ cmd: path.join(dir, exe('solution')), args: [] })
  }
};

function exe(name) {
  return process.platform === 'win32' ? `${name}.exe` : name;
}

function childEnv() {
  return {
    PATH: process.env.PATH,
    SYSTEMROOT: process.env.SYSTEMROOT,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP
  };
}

function runProcess({ cmd, args, dir, input, timeoutMs }) {
  return new Promise(resolve => {
    const child = spawn(cmd, args, {
      cwd: dir,
      env: childEnv(),
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let killedForOutput = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

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

    child.on('error', err => {
      clearTimeout(timer);
      resolve({ stdout: '', stderr: `Failed to start: ${err.message}`, exitCode: 1, timedOut: false });
    });

    child.stdin.on('error', () => {});
    child.stdin.write(input || '');
    child.stdin.end();

    child.on('close', exitCode => {
      clearTimeout(timer);
      let error = stderr;
      if (timedOut) error = 'Execution timed out';
      if (killedForOutput) error = 'Output limit exceeded';
      resolve({ stdout: stdout.slice(0, MAX_OUTPUT), stderr: error, exitCode, timedOut });
    });
  });
}

async function prepare(code, language) {
  const spec = LANGUAGES[language];
  if (!spec) return { error: `Unsupported language: ${language}` };
  if (code.length > MAX_CODE_LENGTH) return { error: 'Code exceeds maximum length' };

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccr-'));
  fs.writeFileSync(path.join(dir, spec.sourceFile), code);

  if (spec.compile) {
    const step = spec.compile(dir);
    const result = await runProcess({
      cmd: step.cmd, args: step.args, dir, input: '', timeoutMs: COMPILE_TIMEOUT_MS
    });
    if (result.exitCode !== 0) {
      cleanup(dir);
      return { error: 'Compilation failed', compileOutput: result.stderr || result.stdout };
    }
  }

  return { dir, spec };
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
}

async function runTests(code, testCases, language = 'python') {
  const prepared = await prepare(code, language);

  if (prepared.error) {
    return {
      results: [],
      passed: 0,
      total: testCases.length,
      compileError: prepared.error,
      compileOutput: prepared.compileOutput || null
    };
  }

  const { dir, spec } = prepared;
  const results = [];

  try {
    for (const test of testCases) {
      const step = spec.run(dir);
      const r = await runProcess({
        cmd: step.cmd, args: step.args, dir, input: test.input, timeoutMs: TIMEOUT_MS
      });

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
  } finally {
    cleanup(dir);
  }

  const passed = results.filter(r => r.passed).length;
  return { results, passed, total: results.length, compileError: null, compileOutput: null };
}

module.exports = { runTests, LANGUAGES };