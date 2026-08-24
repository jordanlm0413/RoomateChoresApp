import { requireAuth, requireHomeMember, json, newId } from "../../../../_lib/auth.js";

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
    `SELECT id, title, assignee, room, due_date AS dueDate, done
     FROM chores WHERE home_id = ? ORDER BY created_at DESC`
  )
    .bind(homeId)
    .all();

  return json({ chores: results.map((c) => ({ ...c, done: !!c.done })) });
}

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const auth = await requireAuth(context);
  if (auth.error) return auth.error;

  const homeId = params.homeId;
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
