import { hashPassword, createSession, json, newId } from "../../_lib/auth.js";

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,24}$/;

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, { status: 400 });
  }

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
  } catch (err) {
    // Unique constraint race condition
    return json({ error: "That username is already taken." }, { status: 409 });
  }

  const cookie = await createSession(env, id, request);
  return json(
    { user: { id, username } },
    { status: 201, headers: { "Set-Cookie": cookie } }
  );
}
