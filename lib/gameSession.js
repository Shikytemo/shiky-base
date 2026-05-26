// ─── Game Session Manager ───
// Track active quiz games per user with timeout & answer validation

const GAME_TIMEOUT = 120 * 1000; // 2 menit
const _sessions = new Map();

// Cleanup expired sessions every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, sess] of _sessions) {
    if (now - sess.ts > GAME_TIMEOUT) _sessions.delete(key);
  }
}, 60_000);

export function startGame(userId, gameType, answer, reward = {}) {
  _sessions.set(userId, {
    gameType,
    answer: String(answer).toLowerCase().trim(),
    ts: Date.now(),
    reward: {
      xp: reward.xp || 50,
      money: reward.money || 200,
    },
    tries: 0,
  });
}

export function getGame(userId) {
  const sess = _sessions.get(userId);
  if (!sess) return null;
  if (Date.now() - sess.ts > GAME_TIMEOUT) {
    _sessions.delete(userId);
    return null;
  }
  return sess;
}

export function checkAnswer(userId, userAnswer) {
  const sess = getGame(userId);
  if (!sess) return { active: false };

  sess.tries++;
  const normalized = String(userAnswer).toLowerCase().trim();
  
  if (normalized === sess.answer) {
    _sessions.delete(userId);
    return { active: true, correct: true, tries: sess.tries, reward: sess.reward, gameType: sess.gameType };
  }

  // Wrong answer
  if (sess.tries >= 3) {
    _sessions.delete(userId);
    return { active: true, correct: false, tries: sess.tries, expired: true, answer: sess.answer, gameType: sess.gameType };
  }

  return { active: true, correct: false, tries: sess.tries, remaining: 3 - sess.tries, gameType: sess.gameType };
}

export function endGame(userId) {
  _sessions.delete(userId);
}

export { _sessions };