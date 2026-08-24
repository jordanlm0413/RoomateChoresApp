import { requireAuth, requireHomeMember, json } from "../../../_lib/auth.js";

export async function onRequestGet(context) {
  const { env, params } = context;
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  const homeId = params.homeId;
  const role = await requireHomeMember(env, homeId, auth.user.id);
  if (!role) {
    return json({ error: "You are not a member of this home." }, { status: 403 });
  }

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

export async function onRequestDelete(context) {
  const { env, params, request } = context;
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  const homeId = params.homeId;
  const url = new URL(request.url);
  const targetUserId = url.searchParams.get("userId");
  if (!targetUserId) {
    return json({ error: "userId is required." }, { status: 400 });
  }

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
