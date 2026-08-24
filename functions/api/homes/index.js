import { requireAuth, json, newId, newInviteCode } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const { env } = context;
  const auth = await requireAuth(context);
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

  const name = String(body.name || "").trim();
  if (name.length < 2 || name.length > 60) {
    return json({ error: "Home name must be 2-60 characters." }, { status: 400 });
  }

  const homeId = newId();
  let inviteCode = newInviteCode();

  // Ensure invite code uniqueness (extremely unlikely to collide, but check anyway)
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
