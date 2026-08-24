import { verifyPassword, createSession, json } from "../../_lib/auth.js";

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

  const user = await env.DB.prepare(
    "SELECT id, username, password_hash FROM users WHERE username = ?"
  )
    .bind(username)
    .first();

  if (!user) {
    return json({ error: "Invalid username or password." }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return json({ error: "Invalid username or password." }, { status: 401 });
  }

  const cookie = await createSession(env, user.id, request);
  return json(
    { user: { id: user.id, username: user.username } },
    { headers: { "Set-Cookie": cookie } }
  );
}
