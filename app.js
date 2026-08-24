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

const mainTabs = document.querySelectorAll(".main-tab");
const tabPanels = document.querySelectorAll("[data-tab-panel]");

const calendarGrid = document.getElementById("calendar-grid");
const calendarMonthLabel = document.getElementById("calendar-month-label");
const calendarPrevBtn = document.getElementById("calendar-prev");
const calendarNextBtn = document.getElementById("calendar-next");
const calendarTodayBtn = document.getElementById("calendar-today");

const settingsTabs = document.querySelectorAll("[data-settings-tab]");
const settingsPanels = document.querySelectorAll("[data-settings-panel]");
const accountForm = document.getElementById("account-form");
const settingsUsernameInput = document.getElementById("settings-username");
const settingsNewPasswordInput = document.getElementById("settings-new-password");
const settingsCurrentPasswordInput = document.getElementById("settings-current-password");
const accountErrorEl = document.getElementById("account-error");
const accountSuccessEl = document.getElementById("account-success");

const renameHomeForm = document.getElementById("rename-home-form");
const renameHomeInput = document.getElementById("rename-home-input");
const regenerateCodeBtn = document.getElementById("regenerate-code-btn");
const leaveHomeBtn = document.getElementById("leave-home-btn");
const deleteHomeBtn = document.getElementById("delete-home-btn");
const settingsHomeErrorEl = document.getElementById("settings-home-error");
const settingsHomeSuccessEl = document.getElementById("settings-home-success");

let calendarCursor = new Date();
calendarCursor.setDate(1);

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

  renderHomeSettingsPanel();
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
    renderCalendar();
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

// --- Main tab navigation ---

mainTabs.forEach((tabBtn) => {
  tabBtn.addEventListener("click", () => {
    const target = tabBtn.dataset.tab;
    mainTabs.forEach((btn) => btn.classList.toggle("active", btn === tabBtn));
    tabPanels.forEach((panel) => {
      panel.hidden = panel.dataset.tabPanel !== target;
    });
    if (target === "calendar") renderCalendar();
    if (target === "settings") renderHomeSettingsPanel();
  });
});

// --- Calendar ---

function renderCalendar() {
  if (!calendarGrid) return;

  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
  calendarMonthLabel.textContent = monthFormatter.format(calendarCursor);

  const choresByDate = {};
  chores.forEach((chore) => {
    if (!chore.dueDate || chore.dueDate === "No due date") return;
    (choresByDate[chore.dueDate] ||= []).push(chore);
  });

  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);

  calendarGrid.innerHTML = "";

  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((label) => {
    const headerCell = document.createElement("div");
    headerCell.className = "calendar-weekday";
    headerCell.textContent = label;
    calendarGrid.appendChild(headerCell);
  });

  for (let i = 0; i < startWeekday; i++) {
    const blank = document.createElement("div");
    blank.className = "calendar-cell calendar-cell-blank";
    calendarGrid.appendChild(blank);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayChores = choresByDate[dateStr] || [];

    const cell = document.createElement("div");
    cell.className = "calendar-cell";
    if (dateStr === todayStr) cell.classList.add("calendar-cell-today");

    const dayNumber = document.createElement("div");
    dayNumber.className = "calendar-day-number";
    dayNumber.textContent = String(day);
    cell.appendChild(dayNumber);

    dayChores.forEach((chore) => {
      const item = document.createElement("div");
      item.className = `calendar-chore ${chore.done ? "done" : ""}`;
      item.textContent = chore.title;
      item.title = `${chore.title} · ${chore.assignee}`;
      cell.appendChild(item);
    });

    calendarGrid.appendChild(cell);
  }
}

calendarPrevBtn.addEventListener("click", () => {
  calendarCursor.setMonth(calendarCursor.getMonth() - 1);
  renderCalendar();
});

calendarNextBtn.addEventListener("click", () => {
  calendarCursor.setMonth(calendarCursor.getMonth() + 1);
  renderCalendar();
});

calendarTodayBtn.addEventListener("click", () => {
  calendarCursor = new Date();
  calendarCursor.setDate(1);
  renderCalendar();
});

// --- Settings: sub-tabs ---

settingsTabs.forEach((tabBtn) => {
  tabBtn.addEventListener("click", () => {
    const target = tabBtn.dataset.settingsTab;
    settingsTabs.forEach((btn) => btn.classList.toggle("active", btn === tabBtn));
    settingsPanels.forEach((panel) => {
      panel.hidden = panel.dataset.settingsPanel !== target;
    });
  });
});

// --- Settings: account ---

function showAccountError(message) {
  accountSuccessEl.hidden = true;
  accountErrorEl.textContent = message;
  accountErrorEl.hidden = false;
}

function showAccountSuccess(message) {
  accountErrorEl.hidden = true;
  accountSuccessEl.textContent = message;
  accountSuccessEl.hidden = false;
}

accountForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const newUsername = settingsUsernameInput.value.trim();
  const newPassword = settingsNewPasswordInput.value;
  const currentPassword = settingsCurrentPasswordInput.value;

  if (!newUsername && !newPassword) {
    showAccountError("Enter a new username and/or new password to update.");
    return;
  }

  try {
    const { user } = await api("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newUsername: newUsername || null, newPassword: newPassword || null })
    });
    currentUser = user;
    currentUsernameEl.textContent = user.username;
    accountForm.reset();
    showAccountSuccess("Account updated.");
  } catch (err) {
    showAccountError(err.message);
  }
});

// --- Settings: home ---

function showSettingsHomeError(message) {
  settingsHomeSuccessEl.hidden = true;
  settingsHomeErrorEl.textContent = message;
  settingsHomeErrorEl.hidden = false;
}

function showSettingsHomeSuccess(message) {
  settingsHomeErrorEl.hidden = true;
  settingsHomeSuccessEl.textContent = message;
  settingsHomeSuccessEl.hidden = false;
}

function renderHomeSettingsPanel() {
  const home = currentHome();
  const hasHome = Boolean(home);
  const isOwner = hasHome && home.role === "owner";

  renameHomeForm.querySelectorAll("input, button").forEach((el) => (el.disabled = !isOwner));
  regenerateCodeBtn.disabled = !isOwner;
  deleteHomeBtn.disabled = !isOwner;
  leaveHomeBtn.disabled = !hasHome || isOwner;
  renameHomeInput.value = hasHome ? home.name : "";
}

renameHomeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const home = currentHome();
  const name = renameHomeInput.value.trim();
  if (!home || !name) return;

  try {
    await api(`/api/homes/${home.id}`, { method: "PATCH", body: JSON.stringify({ name }) });
    showSettingsHomeSuccess("Home renamed.");
    await loadHomes();
  } catch (err) {
    showSettingsHomeError(err.message);
  }
});

regenerateCodeBtn.addEventListener("click", async () => {
  const home = currentHome();
  if (!home) return;

  try {
    const { inviteCode } = await api(`/api/homes/${home.id}/regenerate-code`, { method: "POST" });
    showSettingsHomeSuccess(`New invite code: ${inviteCode}`);
    await loadHomes();
  } catch (err) {
    showSettingsHomeError(err.message);
  }
});

leaveHomeBtn.addEventListener("click", async () => {
  const home = currentHome();
  if (!home) return;
  if (!confirm(`Leave "${home.name}"?`)) return;

  try {
    await api(`/api/homes/${home.id}/leave`, { method: "POST" });
    selectedHomeId = null;
    await loadHomes();
    showSettingsHomeSuccess("You left the home.");
  } catch (err) {
    showSettingsHomeError(err.message);
  }
});

deleteHomeBtn.addEventListener("click", async () => {
  const home = currentHome();
  if (!home) return;
  if (!confirm(`Delete "${home.name}"? This removes all its chores and members permanently.`)) return;

  try {
    await api(`/api/homes/${home.id}`, { method: "DELETE" });
    selectedHomeId = null;
    await loadHomes();
    showSettingsHomeSuccess("Home deleted.");
  } catch (err) {
    showSettingsHomeError(err.message);
  }
});

init();
