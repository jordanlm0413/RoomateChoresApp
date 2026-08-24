// Shared helpers for Pages Functions. Files under an underscore-prefixed folder
// are NOT routable — safe to import from route handlers.

const SESSION_COOKIE = "session_id";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function newId() {
  return crypto.randomUUID();
}

function toHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function deriveBits(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveBits(password, salt);
  return `${toHex(salt)}:${toHex(hash)}`;
}

async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = String(stored).split(":");
  if (!saltHex || !hashHex) return false;
  const salt = fromHex(saltHex);
  const hash = await deriveBits(password, salt);
  const computedHex = toHex(hash);
  if (computedHex.length !== hashHex.length) return false;
  // constant-time comparison
  let diff = 0;
  for (let i = 0; i < computedHex.length; i++) {
    diff |= computedHex.charCodeAt(i) ^ hashHex.charCodeAt(i);
  }
  return diff === 0;
}

function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const cookies = {};
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

function sessionCookieHeader(token, request) {
  const secure = new URL(request.url).protocol === "https:" ? " Secure;" : "";
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly;${secure} SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function clearCookieHeader(request) {
  const secure = new URL(request.url).protocol === "https:" ? " Secure;" : "";
  return `${SESSION_COOKIE}=; HttpOnly;${secure} SameSite=Lax; Path=/; Max-Age=0`;
}

async function createSession(env, userId, request) {
  const token = newId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(token, userId, expiresAt)
    .run();
  return sessionCookieHeader(token, request);
}

async function getSessionUser(context) {
  const { request, env } = context;
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  const row = await env.DB.prepare(
    `SELECT users.id AS id, users.username AS username, sessions.expires_at AS expires_at
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.id = ?`
  )
    .bind(token)
    .first();

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(token).run();
    return null;
  }
  return { id: row.id, username: row.username };
}

async function destroySession(context) {
  const { request, env } = context;
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE];
  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(token).run();
  }
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function requireAuth(context) {
  const user = await getSessionUser(context);
  if (!user) {
    return { error: json({ error: "Not signed in." }, { status: 401 }) };
  }
  return { user };
}

async function requireHomeMember(env, homeId, userId) {
  const row = await env.DB.prepare(
    "SELECT role FROM home_members WHERE home_id = ? AND user_id = ?"
  )
    .bind(homeId, userId)
    .first();
  return row ? row.role : null;
}

function newInviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return toHex(bytes).toUpperCase();
}

export {
  newId,
  hashPassword,
  verifyPassword,
  createSession,
  getSessionUser,
  destroySession,
  clearCookieHeader,
  json,
  requireAuth,
  requireHomeMember,
  newInviteCode,
};
