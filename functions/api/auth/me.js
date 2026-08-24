import { getSessionUser, json } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const user = await getSessionUser(context);
  if (!user) {
    return json({ error: "Not signed in." }, { status: 401 });
  }
  return json({ user });
}
