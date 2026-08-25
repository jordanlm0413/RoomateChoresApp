const currentUsernameEl = document.getElementById("current-username");
const logoutBtn = document.getElementById("logout-btn");
const themeToggleBtn = document.getElementById("theme-toggle");

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
const homeSuccessEl = document.getElementById("home-success");

const form = document.getElementById("chore-form");
const titleInput = document.getElementById("title");
const assigneeInput = document.getElementById("assignee");
const roomInput = document.getElementById("room");
const dueDateInput = document.getElementById("dueDate");
const categoryInput = document.getElementById("category");
const recurrenceInput = document.getElementById("recurrence");
const listEl = document.getElementById("chore-list");
const emptyState = document.getElementById("empty-state");
const filterEl = document.getElementById("filter");
const clearDoneBtn = document.getElementById("clear-done");
const choreSearchInput = document.getElementById("chore-search");
const randomizeBtn = document.getElementById("randomize-btn");
const reminderBanner = document.getElementById("reminder-banner");
const activityListEl = document.getElementById("activity-list");
const activityEmptyEl = document.getElementById("activity-empty");

const mainTabs = document.querySelectorAll(".main-tab");
const tabPanels = document.querySelectorAll("[data-tab-panel]");

const calendarGrid = document.getElementById("calendar-grid");
const calendarMonthLabel = document.getElementById("calendar-month-label");
const calendarPrevBtn = document.getElementById("calendar-prev");
const calendarNextBtn = document.getElementById("calendar-next");
const calendarTodayBtn = document.getElementById("calendar-today");
const calendarDayLabel = document.getElementById("calendar-day-label");
const calendarDayList = document.getElementById("calendar-day-list");
const calendarDayEmpty = document.getElementById("calendar-day-empty");

const settingsTabs = document.querySelectorAll("[data-settings-tab]");
const settingsPanels = document.querySelectorAll("[data-settings-panel]");
const accountForm = document.getElementById("account-form");
const settingsUsernameInput = document.getElementById("settings-username");
const settingsDisplayNameInput = document.getElementById("settings-display-name");
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
const createGroupForm = document.getElementById("create-group-form");
const newGroupNameInput = document.getElementById("new-group-name");
const groupListEl = document.getElementById("group-list");

let calendarCursor = new Date();
calendarCursor.setDate(1);
let selectedCalendarDate = null;

const SELECTED_HOME_KEY = "roomie_rhythm_selected_home";

let currentUser = null;
let homes = [];
let selectedHomeId = localStorage.getItem(SELECTED_HOME_KEY) || null;
let chores = [];

function currentUserNameLabel(user = currentUser) {
  if (!user) return "";
  const username = String(user.username || "");
  const displayName = String(user.displayName || "").trim();
  if (displayName && displayName !== username) {
    return `${escapeHtml(displayName)} <span class="user-name-meta">@${escapeHtml(username)}</span>`;
  }
  return escapeHtml(username);
}

function memberNameLabel(member) {
  const username = String(member.username || "");
  const displayName = String(member.displayName || "").trim();
  if (displayName && displayName !== username) {
    return `${escapeHtml(displayName)} <span class="user-name-meta">@${escapeHtml(username)}</span>`;
  }
  return escapeHtml(username);
}

function memberNameText(member) {
  const username = String(member.username || "");
  const displayName = String(member.displayName || "").trim();
  if (displayName && displayName !== username) {
    return `${displayName} (@${username})`;
  }
  return username;
}

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
  homeSuccessEl.hidden = true;
  homeErrorEl.textContent = message;
  homeErrorEl.hidden = false;
}

function showHomeSuccess(message) {
  homeErrorEl.hidden = true;
  homeSuccessEl.textContent = message;
  homeSuccessEl.hidden = false;
}

function clearHomeError() {
  homeErrorEl.hidden = true;
  homeErrorEl.textContent = "";
  homeSuccessEl.hidden = true;
  homeSuccessEl.textContent = "";
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const skipAuth = params.get("skipAuth") === "1";

  if (!skipAuth) {
    try {
      const { user } = await api("/api/auth/me");
      currentUser = user;
    } catch {
      window.location.href = "auth.html";
      return;
    }

    currentUsernameEl.innerHTML = currentUserNameLabel(currentUser);
    if (settingsDisplayNameInput) settingsDisplayNameInput.value = currentUser.displayName || "";
  }

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
  await Promise.all([loadMembers(home.id), loadChores(home.id), loadActivity(home.id), loadGroups(home.id)]);
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
      <span class="member-name-wrap">
        <span>${memberNameLabel(member)}</span>
        ${isOwner ? '<span class="role-badge">owner</span>' : ""}
      </span>
      ${canRemove ? `<button type="button" class="danger" data-user-id="${member.id}" aria-label="Remove ${escapeHtml(memberNameText(member))}">Remove</button>` : ""}
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
    renderReminderBanner();
  } catch (err) {
    showHomeError(err.message);
  }
}

function renderReminderBanner() {
  if (!reminderBanner) return;
  const todayStr = new Date().toISOString().slice(0, 10);
  const open = chores.filter((c) => !c.done && c.dueDate && c.dueDate !== "No due date");
  const overdue = open.filter((c) => c.dueDate < todayStr);
  const dueToday = open.filter((c) => c.dueDate === todayStr);

  if (overdue.length === 0 && dueToday.length === 0) {
    reminderBanner.hidden = true;
    return;
  }

  const parts = [];
  if (overdue.length) parts.push(`${overdue.length} chore(s) overdue`);
  if (dueToday.length) parts.push(`${dueToday.length} chore(s) due today`);
  reminderBanner.textContent = parts.join(" · ");
  reminderBanner.hidden = false;
  reminderBanner.classList.toggle("reminder-banner-urgent", overdue.length > 0);
}

async function loadActivity(homeId) {
  try {
    const { activity } = await api(`/api/homes/${homeId}/activity`);
    renderActivity(activity);
  } catch (err) {
    showHomeError(err.message);
  }
}

function renderActivity(activity) {
  if (!activityListEl) return;
  activityListEl.innerHTML = "";
  activity.forEach((entry) => {
    const li = document.createElement("li");
    const when = new Date(entry.createdAt.replace(" ", "T") + "Z").toLocaleString();
    li.textContent = `${entry.actor} ${entry.action}${entry.detail ? ` "${entry.detail}"` : ""} · ${when}`;
    activityListEl.appendChild(li);
  });
  activityEmptyEl.hidden = activity.length !== 0;
}

async function loadGroups(homeId) {
  try {
    const { groups } = await api(`/api/homes/${homeId}/groups`);
    renderGroups(groups);
  } catch (err) {
    showHomeError(err.message);
  }
}

function renderGroups(groups) {
  if (!groupListEl) return;
  const home = currentHome();
  const isOwner = home && home.role === "owner";
  groupListEl.innerHTML = "";

  groups.forEach((group) => {
    const li = document.createElement("li");
    li.className = "group-item";
    const memberChips = group.members
      .map(
        (m) => `<span class="chip">${memberNameLabel(m)}${isOwner ? ` <button type="button" data-action="remove-group-member" data-group-id="${group.id}" data-user-id="${m.id}" aria-label="Remove ${escapeHtml(memberNameText(m))} from ${escapeHtml(group.name)}">&times;</button>` : ""}</span>`
      )
      .join(" ");
    li.innerHTML = `
      <div class="group-item-head">
        <strong>${escapeHtml(group.name)}</strong>
        ${isOwner ? `<button type="button" class="danger" data-action="delete-group" data-group-id="${group.id}">Delete</button>` : ""}
      </div>
      <div class="chip-row">${memberChips || '<span class="hint">No members yet.</span>'}</div>
      ${
        isOwner
          ? `<form class="inline-form" data-action="add-group-member" data-group-id="${group.id}">
              <label>
                Add member by username
                <input type="text" maxlength="24" data-group-username-input required />
              </label>
              <button type="submit" class="btn ghost">Add</button>
            </form>`
          : ""
      }
    `;
    groupListEl.appendChild(li);
  });
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
  let visible = chores;
  if (filterEl.value === "open") {
    visible = visible.filter((c) => !c.done);
  } else if (filterEl.value === "done") {
    visible = visible.filter((c) => c.done);
  }

  const query = choreSearchInput.value.trim().toLowerCase();
  if (query) {
    visible = visible.filter((c) =>
      [c.title, c.assignee, c.room, c.category].some((field) => field && field.toLowerCase().includes(query))
    );
  }

  return visible;
}

function render() {
  const visible = filteredChores();
  listEl.innerHTML = "";

  visible.forEach((chore) => {
    const li = document.createElement("li");
    li.className = `chore ${chore.done ? "done" : ""}`;
    const metaParts = [chore.assignee, chore.room, chore.dueDate];
    if (chore.category) metaParts.push(chore.category);
    if (chore.recurrence && chore.recurrence !== "none") metaParts.push(`repeats ${chore.recurrence}`);
    li.innerHTML = `
      <div>
        <strong class="title">${escapeHtml(chore.title)}</strong>
        <div class="meta">${metaParts.map(escapeHtml).join(" · ")}</div>
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
        dueDate: dueDateInput.value,
        category: categoryInput.value.trim(),
        recurrence: recurrenceInput.value
      })
    });
    form.reset();
    roomInput.value = "Kitchen";
    recurrenceInput.value = "none";
    await loadChores(home.id);
    await loadActivity(home.id);
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
    await loadActivity(home.id);
  } catch (err) {
    showHomeError(err.message);
  }
});

filterEl.addEventListener("change", render);
choreSearchInput.addEventListener("input", render);

randomizeBtn.addEventListener("click", async () => {
  const home = currentHome();
  if (!home) return;

  try {
    const { count } = await api(`/api/homes/${home.id}/chores/randomize`, { method: "POST" });
    await loadChores(home.id);
    await loadActivity(home.id);
    showHomeSuccess(`Randomized assignments for ${count} open chore(s).`);
  } catch (err) {
    showHomeError(err.message);
  }
});

clearDoneBtn.addEventListener("click", async () => {
  const home = currentHome();
  if (!home) return;
  const doneChores = chores.filter((c) => c.done);
  try {
    await Promise.all(
      doneChores.map((c) => api(`/api/homes/${home.id}/chores/${c.id}`, { method: "DELETE" }))
    );
    await loadChores(home.id);
    await loadActivity(home.id);
  } catch (err) {
    showHomeError(err.message);
  }
});

// --- Main tab navigation ---

function activateMainTab(tabBtn) {
  const target = tabBtn.dataset.tab;
  mainTabs.forEach((btn) => {
    const isActive = btn === tabBtn;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
    btn.tabIndex = isActive ? 0 : -1;
  });
  tabPanels.forEach((panel) => {
    panel.hidden = panel.dataset.tabPanel !== target;
  });
  if (target === "calendar") renderCalendar();
  if (target === "settings") renderHomeSettingsPanel();
}

mainTabs.forEach((tabBtn, index) => {
  tabBtn.addEventListener("click", () => activateMainTab(tabBtn));
  tabBtn.addEventListener("keydown", (event) => {
    let nextIndex = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % mainTabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + mainTabs.length) % mainTabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = mainTabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = mainTabs[nextIndex];
    activateMainTab(next);
    next.focus();
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
    if (dateStr === selectedCalendarDate) cell.classList.add("calendar-cell-selected");
    cell.dataset.date = dateStr;
    cell.tabIndex = 0;
    cell.setAttribute("role", "button");

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

  renderCalendarDayDetail(choresByDate);
}

function renderCalendarDayDetail(choresByDate) {
  if (!calendarDayLabel) return;

  if (!selectedCalendarDate) {
    calendarDayLabel.textContent = "Select a day";
    calendarDayList.innerHTML = "";
    calendarDayEmpty.hidden = false;
    calendarDayEmpty.textContent = "Click a day on the calendar to see its chores.";
    return;
  }

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
  const [y, m, d] = selectedCalendarDate.split("-").map(Number);
  calendarDayLabel.textContent = dateFormatter.format(new Date(y, m - 1, d));

  const dayChores = choresByDate[selectedCalendarDate] || [];
  calendarDayList.innerHTML = "";
  dayChores.forEach((chore) => {
    const li = document.createElement("li");
    li.className = `chore ${chore.done ? "done" : ""}`;
    li.innerHTML = `
      <div>
        <strong class="title">${escapeHtml(chore.title)}</strong>
        <div class="meta">${escapeHtml(chore.assignee)} · ${escapeHtml(chore.room)}</div>
      </div>
      <div class="row-actions">
        <button type="button" data-action="toggle" data-id="${chore.id}">${chore.done ? "Undo" : "Done"}</button>
        <button type="button" class="danger" data-action="delete" data-id="${chore.id}">Delete</button>
      </div>
    `;
    calendarDayList.appendChild(li);
  });

  calendarDayEmpty.hidden = dayChores.length !== 0;
  calendarDayEmpty.textContent = "No chores due this day.";
}

calendarGrid.addEventListener("click", (event) => {
  const cell = event.target.closest("[data-date]");
  if (!cell) return;
  selectedCalendarDate = cell.dataset.date;
  renderCalendar();
});

calendarDayList.addEventListener("click", async (event) => {
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
  selectedCalendarDate = new Date().toISOString().slice(0, 10);
  renderCalendar();
});

// --- Settings: sub-tabs ---

function activateSettingsTab(tabBtn) {
  const target = tabBtn.dataset.settingsTab;
  settingsTabs.forEach((btn) => {
    const isActive = btn === tabBtn;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
    btn.tabIndex = isActive ? 0 : -1;
  });
  settingsPanels.forEach((panel) => {
    panel.hidden = panel.dataset.settingsPanel !== target;
  });
}

settingsTabs.forEach((tabBtn, index) => {
  tabBtn.addEventListener("click", () => activateSettingsTab(tabBtn));
  tabBtn.addEventListener("keydown", (event) => {
    let nextIndex = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % settingsTabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + settingsTabs.length) % settingsTabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = settingsTabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = settingsTabs[nextIndex];
    activateSettingsTab(next);
    next.focus();
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
  const newDisplayName = settingsDisplayNameInput.value.trim();
  const newPassword = settingsNewPasswordInput.value;
  const currentPassword = settingsCurrentPasswordInput.value;

  if (!newUsername && !newPassword && !newDisplayName) {
    showAccountError("Enter a new username, display name, and/or new password to update.");
    return;
  }

  try {
    const payload = {
      currentPassword,
      newUsername: newUsername || null,
      newPassword: newPassword || null
    };
    if (newDisplayName) payload.newDisplayName = newDisplayName;

    const { user } = await api("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    currentUser = user;
    currentUsernameEl.innerHTML = currentUserNameLabel(user);
    if (settingsDisplayNameInput) settingsDisplayNameInput.value = user.displayName || "";
    accountForm.reset();
    if (settingsDisplayNameInput) settingsDisplayNameInput.value = user.displayName || "";
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

// --- Groups ---

createGroupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const home = currentHome();
  const name = newGroupNameInput.value.trim();
  if (!home || !name) return;

  try {
    await api(`/api/homes/${home.id}/groups`, { method: "POST", body: JSON.stringify({ name }) });
    createGroupForm.reset();
    await loadGroups(home.id);
  } catch (err) {
    showSettingsHomeError(err.message);
  }
});

groupListEl.addEventListener("click", async (event) => {
  const home = currentHome();
  if (!home) return;

  const deleteBtn = event.target.closest('[data-action="delete-group"]');
  if (deleteBtn) {
    if (!confirm("Delete this group?")) return;
    try {
      await api(`/api/homes/${home.id}/groups/${deleteBtn.dataset.groupId}`, { method: "DELETE" });
      await loadGroups(home.id);
    } catch (err) {
      showSettingsHomeError(err.message);
    }
    return;
  }

  const removeMemberBtn = event.target.closest('[data-action="remove-group-member"]');
  if (removeMemberBtn) {
    try {
      await api(
        `/api/homes/${home.id}/groups/${removeMemberBtn.dataset.groupId}/members?userId=${encodeURIComponent(removeMemberBtn.dataset.userId)}`,
        { method: "DELETE" }
      );
      await loadGroups(home.id);
    } catch (err) {
      showSettingsHomeError(err.message);
    }
  }
});

groupListEl.addEventListener("submit", async (event) => {
  const form = event.target.closest('[data-action="add-group-member"]');
  if (!form) return;
  event.preventDefault();

  const home = currentHome();
  if (!home) return;

  const usernameInput = form.querySelector("[data-group-username-input]");
  const username = usernameInput.value.trim();
  if (!username) return;

  try {
    await api(`/api/homes/${home.id}/groups/${form.dataset.groupId}/members`, {
      method: "POST",
      body: JSON.stringify({ username })
    });
    await loadGroups(home.id);
  } catch (err) {
    showSettingsHomeError(err.message);
  }
});

// --- Theme toggle ---

const THEME_KEY = "roomie_rhythm_theme";

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  if (themeToggleBtn) {
    const isDark = theme === "dark";
    themeToggleBtn.setAttribute("aria-pressed", String(isDark));
    themeToggleBtn.textContent = isDark ? "Light Mode" : "Dark Mode";
  }
}

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(stored || (prefersDark ? "dark" : "light"));
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });
}

initTheme();

init();
