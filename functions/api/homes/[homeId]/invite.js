import { requireAuth, requireHomeMember, json } from "../../../_lib/auth.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  const homeId = params.homeId;
  const role = await requireHomeMember(env, homeId, auth.user.id);
  if (role !== "owner") {
    return json({ error: "Only the home owner can invite members." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, { status: 400 });
  }

  const username = String(body.username || "").trim();
  const invitee = await env.DB.prepare("SELECT id, username FROM users WHERE username = ?")
    .bind(username)
    .first();

  if (!invitee) {
    return json({ error: "No user found with that username." }, { status: 404 });
  }

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
