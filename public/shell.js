async function loadUser(requiredRole) {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.href = '/login.html';
      return null;
    }
    const { user } = await res.json();
    if (requiredRole && user.role !== requiredRole) {
      window.location.href = user.role === 'reviewer' ? '/reviewer.html' : '/index.html';
      return null;
    }
    return user;
  } catch {
    window.location.href = '/login.html';
    return null;
  }
}

function renderShell(user, activeItem) {
  document.getElementById('user-name').textContent = user.displayName;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.nav === activeItem);
  });
  document.getElementById('logout').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });
}