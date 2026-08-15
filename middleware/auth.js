const { getUserById } = require('../data/users');

function attachUser(req, res, next) {
   console.log('session:', req.session && req.session.userId);
  if (req.session && req.session.userId) {
    req.user = getUserById(req.session.userId) || null;
  } else {
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { attachUser, requireAuth, requireRole };