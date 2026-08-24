import { requireAuth, json } from "../../_lib/auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, { status: 400 });
  }

  const code = String(body.code || "").trim().toUpperCase();
  if (!code) {
    return json({ error: "Invite code is required." }, { status: 400 });
  }

  const home = await env.DB.prepare(
    "SELECT id, name, owner_id AS ownerId, invite_code AS inviteCode FROM homes WHERE invite_code = ?"
  )
    .bind(code)
    .first();

  if (!home) {
    return json({ error: "No home found with that invite code." }, { status: 404 });
  }

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
