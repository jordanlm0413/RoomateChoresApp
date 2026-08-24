import { destroySession, clearCookieHeader, json } from "../../_lib/auth.js";

export async function onRequestPost(context) {
  await destroySession(context);
  return json({ ok: true }, { headers: { "Set-Cookie": clearCookieHeader(context.request) } });
}
