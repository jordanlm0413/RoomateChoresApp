import {
  hashPassword,
  verifyPassword,
  createSession,
  getSessionUser,
  destroySession,
  clearCookieHeader,
  json,
  requireAuth,
  requireHomeMember,
  newId,
  newInviteCode,
} from "./lib/auth.js";

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,24}$/;

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function handleRegister(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid request body." }, { status: 400 });

  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  if (!USERNAME_RE.test(username)) {
    return json(
      { error: "Username must be 3-24 characters (letters, numbers, _ . -)." },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?")
    .bind(username)
    .first();
  if (existing) {
    return json({ error: "That username is already taken." }, { status: 409 });
  }

  const id = newId();
  const passwordHash = await hashPassword(password);

  try {
    await env.DB.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)")
      .bind(id, username, passwordHash)
      .run();
  } catch {
    return json({ error: "That username is already taken." }, { status: 409 });
  }

  const cookie = await createSession(env, id, request);
  return json({ user: { id, username } }, { status: 201, headers: { "Set-Cookie": cookie } });
}

async function handleLogin(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid request body." }, { status: 400 });

  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  const user = await env.DB.prepare(
    "SELECT id, username, password_hash FROM users WHERE username = ?"
  )
    .bind(username)
    .first();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return json({ error: "Invalid username or password." }, { status: 401 });
  }

  const cookie = await createSession(env, user.id, request);
  return json(
    { user: { id: user.id, username: user.username } },
    { headers: { "Set-Cookie": cookie } }
  );
}

async function handleLogout(request, env) {
  await destroySession(request, env);
  return json({ ok: true }, { headers: { "Set-Cookie": clearCookieHeader(request) } });
}

async function handleMe(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "Not signed in." }, { status: 401 });
  return json({ user });
}

async function handleUpdateAccount(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const body = await readJson(request);
  if (!body) return json({ error: "Invalid request body." }, { status: 400 });

  const currentPassword = String(body.currentPassword || "");
  const newUsername = body.newUsername != null ? String(body.newUsername).trim() : null;
  const newPassword = body.newPassword != null ? String(body.newPassword) : null;

  if (!newUsername && !newPassword) {
    return json({ error: "Nothing to update." }, { status: 400 });
  }

  const user = await env.DB.prepare("SELECT id, password_hash FROM users WHERE id = ?")
    .bind(auth.user.id)
    .first();
  if (!currentPassword || !(await verifyPassword(currentPassword, user.password_hash))) {
    return json({ error: "Current password is incorrect." }, { status: 401 });
  }

  if (newUsername) {
    if (!USERNAME_RE.test(newUsername)) {
      return json(
        { error: "Username must be 3-24 characters (letters, numbers, _ . -)." },
        { status: 400 }
      );
    }
    const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ? AND id != ?")
      .bind(newUsername, auth.user.id)
      .first();
    if (existing) return json({ error: "That username is already taken." }, { status: 409 });
  }

  if (newPassword && newPassword.length < 8) {
    return json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }

  const updates = [];
  const values = [];
  if (newUsername) {
    updates.push("username = ?");
    values.push(newUsername);
  }
  if (newPassword) {
    updates.push("password_hash = ?");
    values.push(await hashPassword(newPassword));
  }
  values.push(auth.user.id);

  await env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  return json({ user: { id: auth.user.id, username: newUsername || auth.user.username } });
}

async function handleListHomes(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const { results } = await env.DB.prepare(
    `SELECT homes.id AS id, homes.name AS name, homes.invite_code AS inviteCode,
            homes.owner_id AS ownerId, home_members.role AS role
     FROM home_members
     JOIN homes ON homes.id = home_members.home_id
     WHERE home_members.user_id = ?
     ORDER BY homes.created_at ASC`
  )
    .bind(auth.user.id)
    .all();

  return json({ homes: results });
}

async function handleCreateHome(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const body = await readJson(request);
  if (!body) return json({ error: "Invalid request body." }, { status: 400 });

  const name = String(body.name || "").trim();
  if (name.length < 2 || name.length > 60) {
    return json({ error: "Home name must be 2-60 characters." }, { status: 400 });
  }

  const homeId = newId();
  let inviteCode = newInviteCode();
  for (let attempts = 0; attempts < 5; attempts++) {
    const existing = await env.DB.prepare("SELECT id FROM homes WHERE invite_code = ?")
      .bind(inviteCode)
      .first();
    if (!existing) break;
    inviteCode = newInviteCode();
  }

  await env.DB.prepare(
    "INSERT INTO homes (id, name, owner_id, invite_code) VALUES (?, ?, ?, ?)"
  )
    .bind(homeId, name, auth.user.id, inviteCode)
    .run();

  await env.DB.prepare(
    "INSERT INTO home_members (home_id, user_id, role) VALUES (?, ?, 'owner')"
  )
    .bind(homeId, auth.user.id)
    .run();

  return json(
    { home: { id: homeId, name, inviteCode, ownerId: auth.user.id, role: "owner" } },
    { status: 201 }
  );
}

async function handleJoinHome(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const body = await readJson(request);
  if (!body) return json({ error: "Invalid request body." }, { status: 400 });

  const code = String(body.code || "").trim().toUpperCase();
  if (!code) return json({ error: "Invite code is required." }, { status: 400 });

  const home = await env.DB.prepare(
    "SELECT id, name, owner_id AS ownerId, invite_code AS inviteCode FROM homes WHERE invite_code = ?"
  )
    .bind(code)
    .first();

  if (!home) return json({ error: "No home found with that invite code." }, { status: 404 });

  const existingMember = await env.DB.prepare(
    "SELECT role FROM home_members WHERE home_id = ? AND user_id = ?"
  )
    .bind(home.id, auth.user.id)
    .first();

  if (existingMember) {
    return json({ home: { ...home, role: existingMember.role } });
  }

  await env.DB.prepare(
    "INSERT INTO home_members (home_id, user_id, role) VALUES (?, ?, 'member')"
  )
    .bind(home.id, auth.user.id)
    .run();

  return json({ home: { ...home, role: "member" } }, { status: 201 });
}

async function handleInvite(request, env, homeId) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const role = await requireHomeMember(env, homeId, auth.user.id);
  if (role !== "owner") {
    return json({ error: "Only the home owner can invite members." }, { status: 403 });
  }

  const body = await readJson(request);
  if (!body) return json({ error: "Invalid request body." }, { status: 400 });

  const username = String(body.username || "").trim();
  const invitee = await env.DB.prepare("SELECT id, username FROM users WHERE username = ?")
    .bind(username)
    .first();
  if (!invitee) return json({ error: "No user found with that username." }, { status: 404 });

  const existingMember = await env.DB.prepare(
    "SELECT 1 FROM home_members WHERE home_id = ? AND user_id = ?"
  )
    .bind(homeId, invitee.id)
    .first();
  if (existingMember) {
    return json({ error: `${invitee.username} is already a member of this home.` }, { status: 409 });
  }

  await env.DB.prepare(
    "INSERT INTO home_members (home_id, user_id, role) VALUES (?, ?, 'member')"
  )
    .bind(homeId, invitee.id)
    .run();

  return json({ member: { id: invitee.id, username: invitee.username, role: "member" } }, { status: 201 });
}

async function handleUpdateHome(request, env, homeId) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const role = await requireHomeMember(env, homeId, auth.user.id);
  if (role !== "owner") {
    return json({ error: "Only the home owner can rename this home." }, { status: 403 });
  }

  const body = await readJson(request);
  if (!body) return json({ error: "Invalid request body." }, { status: 400 });

  const name = String(body.name || "").trim();
  if (name.length < 2 || name.length > 60) {
    return json({ error: "Home name must be 2-60 characters." }, { status: 400 });
  }

  await env.DB.prepare("UPDATE homes SET name = ? WHERE id = ?").bind(name, homeId).run();
  return json({ ok: true, name });
}

async function handleRegenerateInviteCode(request, env, homeId) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const role = await requireHomeMember(env, homeId, auth.user.id);
  if (role !== "owner") {
    return json({ error: "Only the home owner can regenerate the invite code." }, { status: 403 });
  }

  let inviteCode = newInviteCode();
  for (let attempts = 0; attempts < 5; attempts++) {
    const existing = await env.DB.prepare("SELECT id FROM homes WHERE invite_code = ?")
      .bind(inviteCode)
      .first();
    if (!existing) break;
    inviteCode = newInviteCode();
  }

  await env.DB.prepare("UPDATE homes SET invite_code = ? WHERE id = ?")
    .bind(inviteCode, homeId)
    .run();

  return json({ inviteCode });
}

async function handleLeaveHome(request, env, homeId) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const role = await requireHomeMember(env, homeId, auth.user.id);
  if (!role) return json({ error: "You are not a member of this home." }, { status: 403 });
  if (role === "owner") {
    return json(
      { error: "Owners cannot leave a home. Delete it or transfer ownership instead." },
      { status: 400 }
    );
  }

  await env.DB.prepare("DELETE FROM home_members WHERE home_id = ? AND user_id = ?")
    .bind(homeId, auth.user.id)
    .run();

  return json({ ok: true });
}

async function handleDeleteHome(request, env, homeId) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const role = await requireHomeMember(env, homeId, auth.user.id);
  if (role !== "owner") {
    return json({ error: "Only the home owner can delete this home." }, { status: 403 });
  }

  await env.DB.prepare("DELETE FROM homes WHERE id = ?").bind(homeId).run();
  return json({ ok: true });
}

async function handleListMembers(request, env, homeId) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const role = await requireHomeMember(env, homeId, auth.user.id);
  if (!role) return json({ error: "You are not a member of this home." }, { status: 403 });

  const { results } = await env.DB.prepare(
    `SELECT users.id AS id, users.username AS username, home_members.role AS role
     FROM home_members JOIN users ON users.id = home_members.user_id
     WHERE home_members.home_id = ?
     ORDER BY home_members.joined_at ASC`
  )
    .bind(homeId)
    .all();

  return json({ members: results });
}

async function handleRemoveMember(request, env, homeId) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const targetUserId = url.searchParams.get("userId");
  if (!targetUserId) return json({ error: "userId is required." }, { status: 400 });

  const role = await requireHomeMember(env, homeId, auth.user.id);
  if (role !== "owner") {
    return json({ error: "Only the home owner can remove members." }, { status: 403 });
  }
  if (targetUserId === auth.user.id) {
    return json({ error: "Owners cannot remove themselves." }, { status: 400 });
  }

  await env.DB.prepare("DELETE FROM home_members WHERE home_id = ? AND user_id = ?")
    .bind(homeId, targetUserId)
    .run();

  return json({ ok: true });
}

async function handleListChores(request, env, homeId) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const role = await requireHomeMember(env, homeId, auth.user.id);
  if (!role) return json({ error: "You are not a member of this home." }, { status: 403 });

  const { results } = await env.DB.prepare(
    `SELECT id, title, assignee, room, due_date AS dueDate, done
     FROM chores WHERE home_id = ? ORDER BY created_at DESC`
  )
    .bind(homeId)
    .all();

  return json({ chores: results.map((c) => ({ ...c, done: !!c.done })) });
}

async function handleCreateChore(request, env, homeId) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const role = await requireHomeMember(env, homeId, auth.user.id);
  if (!role) return json({ error: "You are not a member of this home." }, { status: 403 });

  const body = await readJson(request);
  if (!body) return json({ error: "Invalid request body." }, { status: 400 });

  const title = String(body.title || "").trim().slice(0, 80);
  const assignee = String(body.assignee || "").trim().slice(0, 40);
  const room = String(body.room || "Other").trim().slice(0, 40);
  const dueDate = body.dueDate ? String(body.dueDate).slice(0, 20) : null;

  if (!title || !assignee) {
    return json({ error: "Title and assignee are required." }, { status: 400 });
  }

  const id = newId();
  await env.DB.prepare(
    "INSERT INTO chores (id, home_id, title, assignee, room, due_date, done) VALUES (?, ?, ?, ?, ?, ?, 0)"
  )
    .bind(id, homeId, title, assignee, room, dueDate)
    .run();

  return json(
    { chore: { id, title, assignee, room, dueDate: dueDate || "No due date", done: false } },
    { status: 201 }
  );
}

async function handleUpdateChore(request, env, homeId, choreId) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const role = await requireHomeMember(env, homeId, auth.user.id);
  if (!role) return json({ error: "You are not a member of this home." }, { status: 403 });

  const body = await readJson(request);
  if (!body) return json({ error: "Invalid request body." }, { status: 400 });

  const done = body.done ? 1 : 0;
  const result = await env.DB.prepare("UPDATE chores SET done = ? WHERE id = ? AND home_id = ?")
    .bind(done, choreId, homeId)
    .run();

  if (result.meta.changes === 0) return json({ error: "Chore not found." }, { status: 404 });
  return json({ ok: true });
}

async function handleDeleteChore(request, env, homeId, choreId) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const role = await requireHomeMember(env, homeId, auth.user.id);
  if (!role) return json({ error: "You are not a member of this home." }, { status: 403 });

  await env.DB.prepare("DELETE FROM chores WHERE id = ? AND home_id = ?")
    .bind(choreId, homeId)
    .run();

  return json({ ok: true });
}

async function routeApi(request, env) {
  const { pathname } = new URL(request.url);
  const method = request.method;
  const parts = pathname.split("/").filter(Boolean); // ["api", ...]

  if (parts[1] === "auth") {
    if (parts[2] === "register" && method === "POST") return handleRegister(request, env);
    if (parts[2] === "login" && method === "POST") return handleLogin(request, env);
    if (parts[2] === "logout" && method === "POST") return handleLogout(request, env);
    if (parts[2] === "me" && method === "GET") return handleMe(request, env);
    if (parts[2] === "me" && method === "PATCH") return handleUpdateAccount(request, env);
    return json({ error: "Not found." }, { status: 404 });
  }

  if (parts[1] === "homes") {
    if (parts.length === 2) {
      if (method === "GET") return handleListHomes(request, env);
      if (method === "POST") return handleCreateHome(request, env);
    }
    if (parts[2] === "join" && parts.length === 3 && method === "POST") {
      return handleJoinHome(request, env);
    }

    const homeId = parts[2];
    if (homeId && parts.length === 3) {
      if (method === "PATCH") return handleUpdateHome(request, env, homeId);
      if (method === "DELETE") return handleDeleteHome(request, env, homeId);
    }
    if (homeId && parts[3] === "invite" && parts.length === 4 && method === "POST") {
      return handleInvite(request, env, homeId);
    }
    if (homeId && parts[3] === "regenerate-code" && parts.length === 4 && method === "POST") {
      return handleRegenerateInviteCode(request, env, homeId);
    }
    if (homeId && parts[3] === "leave" && parts.length === 4 && method === "POST") {
      return handleLeaveHome(request, env, homeId);
    }
    if (homeId && parts[3] === "members" && parts.length === 4) {
      if (method === "GET") return handleListMembers(request, env, homeId);
      if (method === "DELETE") return handleRemoveMember(request, env, homeId);
    }
    if (homeId && parts[3] === "chores") {
      if (parts.length === 4) {
        if (method === "GET") return handleListChores(request, env, homeId);
        if (method === "POST") return handleCreateChore(request, env, homeId);
      }
      const choreId = parts[4];
      if (choreId && parts.length === 5) {
        if (method === "PATCH") return handleUpdateChore(request, env, homeId, choreId);
        if (method === "DELETE") return handleDeleteChore(request, env, homeId, choreId);
      }
    }
  }

  return json({ error: "Not found." }, { status: 404 });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/api/")) {
      return routeApi(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
