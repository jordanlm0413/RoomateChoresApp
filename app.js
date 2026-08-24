const STORE_KEY = "roomie_rhythm_web_chores";

const form = document.getElementById("chore-form");
const titleInput = document.getElementById("title");
const assigneeInput = document.getElementById("assignee");
const roomInput = document.getElementById("room");
const dueDateInput = document.getElementById("dueDate");
const listEl = document.getElementById("chore-list");
const emptyState = document.getElementById("empty-state");
const filterEl = document.getElementById("filter");
const clearDoneBtn = document.getElementById("clear-done");

let chores = loadChores();

function loadChores() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveChores() {
  localStorage.setItem(STORE_KEY, JSON.stringify(chores));
}

function addChore(data) {
  chores.unshift({
    id: `${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    title: data.title,
    assignee: data.assignee,
    room: data.room,
    dueDate: data.dueDate || "No due date",
    done: false
  });
  saveChores();
  render();
}

function removeChore(id) {
  chores = chores.filter((c) => c.id !== id);
  saveChores();
  render();
}

function toggleDone(id) {
  chores = chores.map((c) => (c.id === id ? { ...c, done: !c.done } : c));
  saveChores();
  render();
}

function clearDone() {
  chores = chores.filter((c) => !c.done);
  saveChores();
  render();
}

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

form.addEventListener("submit", (event) => {
  event.preventDefault();
  addChore({
    title: titleInput.value.trim(),
    assignee: assigneeInput.value.trim(),
    room: roomInput.value,
    dueDate: dueDateInput.value
  });
  form.reset();
  roomInput.value = "Kitchen";
});

listEl.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const id = button.dataset.id;
  if (!id) return;

  if (button.dataset.action === "toggle") {
    toggleDone(id);
  }
  if (button.dataset.action === "delete") {
    removeChore(id);
  }
});

filterEl.addEventListener("change", render);
clearDoneBtn.addEventListener("click", clearDone);

render();
