const currentUsernameEl = document.getElementById("current-username");
const logoutBtn = document.getElementById("logout-btn");

const homeSelect = document.getElementById("home-select");
const createHomeForm = document.getElementById("create-home-form");
const newHomeNameInput = document.getElementById("new-home-name");
const joinHomeForm = document.getElementById("join-home-form");
const joinHomeCodeInput = document.getElementById("join-home-code");
const homeDetails = document.getElementById("home-details");
const inviteCodeDisplay = document.getElementById("invite-code-display");
const inviteForm = document.getElementById("invite-form");
const inviteUsernameInput = document.getElementById("invite-username");
const memberListEl = document.getElementById("member-list");
const homeErrorEl = document.getElementById("home-error");

const form = document.getElementById("chore-form");
const titleInput = document.getElementById("title");
const assigneeInput = document.getElementById("assignee");
const roomInput = document.getElementById("room");
const dueDateInput = document.getElementById("dueDate");
const listEl = document.getElementById("chore-list");
const emptyState = document.getElementById("empty-state");
const filterEl = document.getElementById("filter");
const clearDoneBtn = document.getElementById("clear-done");

const SELECTED_HOME_KEY = "roomie_rhythm_selected_home";

let currentUser = null;
let homes = [];
let selectedHomeId = localStorage.getItem(SELECTED_HOME_KEY) || null;
let chores = [];

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong.");
  }
  return data;
}

function showHomeError(message) {
  homeErrorEl.textContent = message;
  homeErrorEl.hidden = false;
}

function clearHomeError() {
  homeErrorEl.hidden = true;
  homeErrorEl.textContent = "";
}

async function init() {
  try {
    const { user } = await api("/api/auth/me");
    currentUser = user;
  } catch {
    window.location.href = "auth.html";
    return;
  }

  currentUsernameEl.textContent = currentUser.username;
  await loadHomes();
}

async function loadHomes() {
  const data = await api("/api/homes");
  homes = data.homes;

  if (!homes.some((h) => h.id === selectedHomeId)) {
    selectedHomeId = homes.length ? homes[0].id : null;
  }
  localStorage.setItem(SELECTED_HOME_KEY, selectedHomeId || "");

  renderHomeSelect();
  await refreshSelectedHome();
}

function renderHomeSelect() {
  homeSelect.innerHTML = "";
  if (homes.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "No homes yet — create one below";
    homeSelect.appendChild(opt);
    homeSelect.disabled = true;
    return;
  }

  homeSelect.disabled = false;
  homes.forEach((home) => {
    const opt = document.createElement("option");
    opt.value = home.id;
    opt.textContent = home.name;
    opt.selected = home.id === selectedHomeId;
    homeSelect.appendChild(opt);
  });
}

function currentHome() {
  return homes.find((h) => h.id === selectedHomeId) || null;
}

async function refreshSelectedHome() {
  const home = currentHome();
  const formsEnabled = Boolean(home);
  form.querySelectorAll("input, select, button").forEach((el) => (el.disabled = !formsEnabled));

  if (!home) {
    homeDetails.hidden = true;
    chores = [];
    render();
    return;
  }

  homeDetails.hidden = false;
  inviteCodeDisplay.textContent = home.inviteCode;

  await Promise.all([loadMembers(home.id), loadChores(home.id)]);
}

async function loadMembers(homeId) {
  try {
    const { members } = await api(`/api/homes/${homeId}/members`);
    renderMembers(members);
  } catch (err) {
    showHomeError(err.message);
  }
}

function renderMembers(members) {
  const home = currentHome();
  memberListEl.innerHTML = "";
  members.forEach((member) => {
    const li = document.createElement("li");
    const isOwner = member.role === "owner";
    const canRemove = home && home.role === "owner" && !isOwner;
    li.innerHTML = `
      <span>${escapeHtml(member.username)} ${isOwner ? '<span class="role-badge">owner</span>' : ""}</span>
      ${canRemove ? `<button type="button" class="danger" data-user-id="${member.id}">Remove</button>` : ""}
    `;
    memberListEl.appendChild(li);
  });
}

async function loadChores(homeId) {
  try {
    const data = await api(`/api/homes/${homeId}/chores`);
    chores = data.chores;
    render();
  } catch (err) {
    showHomeError(err.message);
  }
}

createHomeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearHomeError();
  const name = newHomeNameInput.value.trim();
  if (!name) return;

  try {
    const { home } = await api("/api/homes", {
      method: "POST",
      body: JSON.stringify({ name })
    });
    createHomeForm.reset();
    selectedHomeId = home.id;
    await loadHomes();
  } catch (err) {
    showHomeError(err.message);
  }
});

joinHomeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearHomeError();
  const code = joinHomeCodeInput.value.trim();
  if (!code) return;

  try {
    const { home } = await api("/api/homes/join", {
      method: "POST",
      body: JSON.stringify({ code })
    });
    joinHomeForm.reset();
    selectedHomeId = home.id;
    await loadHomes();
  } catch (err) {
    showHomeError(err.message);
  }
});

homeSelect.addEventListener("change", async () => {
  selectedHomeId = homeSelect.value;
  localStorage.setItem(SELECTED_HOME_KEY, selectedHomeId || "");
  await refreshSelectedHome();
});

inviteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearHomeError();
  const home = currentHome();
  const username = inviteUsernameInput.value.trim();
  if (!home || !username) return;

  try {
    await api(`/api/homes/${home.id}/invite`, {
      method: "POST",
      body: JSON.stringify({ username })
    });
    inviteForm.reset();
    await loadMembers(home.id);
  } catch (err) {
    showHomeError(err.message);
  }
});

memberListEl.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-user-id]");
  if (!button) return;
  const home = currentHome();
  if (!home) return;

  try {
    await api(`/api/homes/${home.id}/members?userId=${encodeURIComponent(button.dataset.userId)}`, {
      method: "DELETE"
    });
    await loadMembers(home.id);
  } catch (err) {
    showHomeError(err.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    window.location.href = "auth.html";
  }
});

function filteredChores() {
  if (filterEl.value === "open") {
    return chores.filter((c) => !c.done);
  }
  if (filterEl.value === "done") {
    return chores.filter((c) => c.done);
  }
  return chores;
}

function render() {
  const visible = filteredChores();
  listEl.innerHTML = "";

  visible.forEach((chore) => {
    const li = document.createElement("li");
    li.className = `chore ${chore.done ? "done" : ""}`;
    li.innerHTML = `
      <div>
        <strong class="title">${escapeHtml(chore.title)}</strong>
        <div class="meta">${escapeHtml(chore.assignee)} · ${escapeHtml(chore.room)} · ${escapeHtml(chore.dueDate)}</div>
      </div>
      <div class="row-actions">
        <button type="button" data-action="toggle" data-id="${chore.id}">${chore.done ? "Undo" : "Done"}</button>
        <button type="button" class="danger" data-action="delete" data-id="${chore.id}">Delete</button>
      </div>
    `;
    listEl.appendChild(li);
  });

  emptyState.style.display = visible.length === 0 ? "block" : "none";
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const home = currentHome();
  if (!home) return;

  try {
    await api(`/api/homes/${home.id}/chores`, {
      method: "POST",
      body: JSON.stringify({
        title: titleInput.value.trim(),
        assignee: assigneeInput.value.trim(),
        room: roomInput.value,
        dueDate: dueDateInput.value
      })
    });
    form.reset();
    roomInput.value = "Kitchen";
    await loadChores(home.id);
  } catch (err) {
    showHomeError(err.message);
  }
});

listEl.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const id = button.dataset.id;
  const home = currentHome();
  if (!id || !home) return;

  try {
    if (button.dataset.action === "toggle") {
      const chore = chores.find((c) => c.id === id);
      await api(`/api/homes/${home.id}/chores/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ done: !chore.done })
      });
    }
    if (button.dataset.action === "delete") {
      await api(`/api/homes/${home.id}/chores/${id}`, { method: "DELETE" });
    }
    await loadChores(home.id);
  } catch (err) {
    showHomeError(err.message);
  }
});

filterEl.addEventListener("change", render);
clearDoneBtn.addEventListener("click", async () => {
  const home = currentHome();
  if (!home) return;
  const doneChores = chores.filter((c) => c.done);
  try {
    await Promise.all(
      doneChores.map((c) => api(`/api/homes/${home.id}/chores/${c.id}`, { method: "DELETE" }))
    );
    await loadChores(home.id);
  } catch (err) {
    showHomeError(err.message);
  }
});

init();
