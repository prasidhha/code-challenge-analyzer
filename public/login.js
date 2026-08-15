const errorEl = document.getElementById('error');
const btn = document.getElementById('signin');

async function signIn() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  errorEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Signing in...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'Sign in failed';
      errorEl.classList.remove('hidden');
      return;
    }

    window.location.href = data.user.role === 'reviewer' ? '/reviewer.html' : '/index.html';
  } catch (err) {
    errorEl.textContent = 'Cannot reach the server';
    errorEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign in';
  }
}

btn.addEventListener('click', signIn);
document.getElementById('password').addEventListener('keydown', e => {
  if (e.key === 'Enter') signIn();
});