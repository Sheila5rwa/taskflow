// ==========================================================================
// TaskFlow — Core Application Logic
// Built with Vanilla JavaScript ES Modules & Local State (Milestone 3)
// ==========================================================================

// Initial in-memory array for milestone 3 local logic verification
let tasks = [
  { id: "sample_1", title: "Review Teknika assessment instructions", completed: true, createdAt: new Date().toISOString() },
  { id: "sample_2", title: "Build TaskFlow semantic UI and CSS layout", completed: true, createdAt: new Date().toISOString() },
  { id: "sample_3", title: "Connect Cloud Firestore for persistence", completed: false, createdAt: new Date().toISOString() }
];

let currentFilter = "all";
let pendingDeleteId = null;

const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const formError = document.getElementById("form-error");
const taskList = document.getElementById("task-list");
const taskCounter = document.getElementById("task-counter");
const clearCompletedBtn = document.getElementById("clear-completed-btn");
const filterButtons = document.querySelectorAll(".filter-btn");
const loadingState = document.getElementById("loading-state");
const emptyState = document.getElementById("empty-state");

function renderTasks() {
  const activeCount = tasks.filter((t) => !t.completed).length;
  taskCounter.textContent = activeCount === 1 ? "1 task left" : `${activeCount} tasks left`;

  const filtered = tasks.filter((task) => {
    if (currentFilter === "active") return !task.completed;
    if (currentFilter === "completed") return task.completed;
    return true;
  });

  taskList.innerHTML = "";
  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  filtered.forEach((task) => {
    const li = document.createElement("li");
    li.className = `task-item ${task.completed ? "completed" : ""}`;
    li.dataset.id = task.id;

    const taskLeft = document.createElement("div");
    taskLeft.className = "task-left";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-checkbox";
    checkbox.checked = task.completed;

    const span = document.createElement("span");
    span.className = "task-title";
    span.textContent = task.title;

    taskLeft.appendChild(checkbox);
    taskLeft.appendChild(span);

    const taskActions = document.createElement("div");
    taskActions.className = "task-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "action-btn action-btn-edit";
    editBtn.textContent = "Edit";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "action-btn action-btn-delete";
    deleteBtn.textContent = "Delete";

    taskActions.appendChild(editBtn);
    taskActions.appendChild(deleteBtn);

    li.appendChild(taskLeft);
    li.appendChild(taskActions);
    taskList.appendChild(li);
  });
}

taskForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const val = taskInput.value.trim();
  if (!val) {
    formError.textContent = "Task title cannot be empty.";
    formError.classList.remove("hidden");
    return;
  }
  tasks.unshift({ id: "task_" + Date.now(), title: val, completed: false, createdAt: new Date().toISOString() });
  taskInput.value = "";
  renderTasks();
});

renderTasks();
loadingState.classList.add("hidden");
