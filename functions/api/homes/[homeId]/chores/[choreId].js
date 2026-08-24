import { requireAuth, requireHomeMember, json } from "../../../../_lib/auth.js";

export async function onRequestPatch(context) {
  const { request, env, params } = context;
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  const { homeId, choreId } = params;
  const role = await requireHomeMember(env, homeId, auth.user.id);
  if (!role) {
    return json({ error: "You are not a member of this home." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, { status: 400 });
  }

  const done = body.done ? 1 : 0;
  const result = await env.DB.prepare(
    "UPDATE chores SET done = ? WHERE id = ? AND home_id = ?"
  )
    .bind(done, choreId, homeId)
    .run();

  if (result.meta.changes === 0) {
    return json({ error: "Chore not found." }, { status: 404 });
  }

  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  const { homeId, choreId } = params;
  const role = await requireHomeMember(env, homeId, auth.user.id);
  if (!role) {
    return json({ error: "You are not a member of this home." }, { status: 403 });
  }

  await env.DB.prepare("DELETE FROM chores WHERE id = ? AND home_id = ?")
    .bind(choreId, homeId)
    .run();

  return json({ ok: true });
}
