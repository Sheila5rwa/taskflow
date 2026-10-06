// ==========================================================================
// TaskFlow — Core Application Logic
// Built with Vanilla JavaScript ES Modules & Cloud Firestore SDK v10.12.2
// ==========================================================================

import { db, isFirebaseConfigured } from "./firebase.js";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================================================================
// State Management
// ==========================================================================
let tasks = [];
let currentFilter = "all"; // 'all' | 'active' | 'completed'
let pendingDeleteId = null;
let isOnlineFirestore = false;

// LocalStorage key for local preview / offline fallback
const LOCAL_STORAGE_KEY = "taskflow_local_tasks";

// ==========================================================================
// DOM Element Selectors
// ==========================================================================
const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const formError = document.getElementById("form-error");
const taskList = document.getElementById("task-list");
const taskCounter = document.getElementById("task-counter");
const clearCompletedBtn = document.getElementById("clear-completed-btn");
const filterButtons = document.querySelectorAll(".filter-btn");
const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const errorMessage = document.getElementById("error-message");
const retryBtn = document.getElementById("retry-btn");
const emptyState = document.getElementById("empty-state");
const emptyTitle = document.getElementById("empty-title");
const emptyHint = document.getElementById("empty-hint");
const deleteDialog = document.getElementById("delete-dialog");
const dialogCancelBtn = document.getElementById("dialog-cancel-btn");
const dialogConfirmBtn = document.getElementById("dialog-confirm-btn");
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");

// ==========================================================================
// Theme Management (Light / Dark Mode with LocalStorage persistence)
// ==========================================================================
function initTheme() {
  const savedTheme = localStorage.getItem("taskflow_theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initialTheme = savedTheme || (prefersDark ? "dark" : "light");

  applyTheme(initialTheme);

  themeToggle.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(newTheme);
    localStorage.setItem("taskflow_theme", newTheme);
  });
}

function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    themeIcon.textContent = "☀️";
    themeToggle.setAttribute("aria-label", "Switch to light mode");
  } else {
    document.documentElement.removeAttribute("data-theme");
    themeIcon.textContent = "🌙";
    themeToggle.setAttribute("aria-label", "Switch to dark mode");
  }
}

// ==========================================================================
// UI Helpers: Errors, Loading & Counters
// ==========================================================================
function showInputError(msg) {
  formError.textContent = msg;
  formError.classList.remove("hidden");
  taskInput.setAttribute("aria-invalid", "true");
}

function clearInputError() {
  formError.textContent = "";
  formError.classList.add("hidden");
  taskInput.removeAttribute("aria-invalid");
}

function showLoading(show) {
  if (show) {
    loadingState.classList.remove("hidden");
  } else {
    loadingState.classList.add("hidden");
  }
}

function showErrorBanner(msg, showRetry = false) {
  errorMessage.textContent = msg;
  errorState.classList.remove("hidden");
  if (showRetry) {
    retryBtn.classList.remove("hidden");
  } else {
    retryBtn.classList.add("hidden");
  }
}

function hideErrorBanner() {
  errorState.classList.add("hidden");
}

function updateTaskCounter() {
  const activeCount = tasks.filter((t) => !t.completed).length;
  const countText = activeCount === 1 ? "1 task left" : `${activeCount} tasks left`;
  taskCounter.textContent = countText;
}

// ==========================================================================
// Data Layer: Firestore Operations & Local Fallback
// ==========================================================================

/**
 * Initializes Firestore listener with real-time updates (onSnapshot)
 * or falls back to local storage if credentials are not yet entered.
 */
function initDataStore() {
  showLoading(true);
  hideErrorBanner();

  if (isFirebaseConfigured() && db) {
    isOnlineFirestore = true;
    try {
      const tasksQuery = query(collection(db, "tasks"), orderBy("createdAt", "desc"));

      // Real-time listener: meets Stretch Goal #1 for instant cross-tab sync!
      onSnapshot(
        tasksQuery,
        (snapshot) => {
          showLoading(false);
          hideErrorBanner();
          tasks = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data()
          }));
          renderTasks();
        },
        (error) => {
          showLoading(false);
          console.error("Firestore Error:", error);
          if (error.code === "permission-denied") {
            showErrorBanner(
              "Firestore permission denied. Check your Firestore Security Rules in the Firebase Console.",
              true
            );
          } else {
            showErrorBanner("Failed to sync tasks from cloud. Operating in offline/cached mode.", true);
          }
        }
      );
    } catch (err) {
      showLoading(false);
      console.error("Setup error:", err);
      showErrorBanner("Error initializing database listener. Please check console.", false);
    }
  } else {
    // Graceful local fallback to allow local testing before Firebase setup
    isOnlineFirestore = false;
    showLoading(false);
    console.info("TaskFlow running in local development mode. Configure firebase.js for cloud persistence.");

    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      tasks = stored ? JSON.parse(stored) : [];
    } catch (e) {
      tasks = [];
    }
    renderTasks();
  }
}

function saveLocalTasks() {
  if (!isOnlineFirestore) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.warn("Could not save to localStorage", e);
    }
  }
}

// 1. Add Task (Create)
async function addTask(title) {
  const trimmed = title.trim();
  if (!trimmed) {
    showInputError("Task title cannot be empty or whitespace.");
    return false;
  }
  if (trimmed.length > 100) {
    showInputError("Task title must be 100 characters or fewer.");
    return false;
  }

  clearInputError();

  if (isOnlineFirestore && db) {
    try {
      await addDoc(collection(db, "tasks"), {
        title: trimmed,
        completed: false,
        createdAt: serverTimestamp()
      });
      return true;
    } catch (err) {
      console.error("Error adding task:", err);
      showErrorBanner("Could not save task to Firestore. Please try again.");
      return false;
    }
  } else {
    // Local in-memory / localStorage mode
    const newTask = {
      id: "local_" + Date.now(),
      title: trimmed,
      completed: false,
      createdAt: new Date().toISOString()
    };
    tasks.unshift(newTask);
    saveLocalTasks();
    renderTasks();
    return true;
  }
}

// 2. Toggle Task Completion (Update)
async function toggleTask(id, currentCompleted) {
  if (isOnlineFirestore && db) {
    try {
      const taskRef = doc(db, "tasks", id);
      await updateDoc(taskRef, {
        completed: !currentCompleted
      });
    } catch (err) {
      console.error("Error updating task status:", err);
      showErrorBanner("Could not update task completion status.");
    }
  } else {
    const task = tasks.find((t) => t.id === id);
    if (task) {
      task.completed = !task.completed;
      saveLocalTasks();
      renderTasks();
    }
  }
}

// 3. Edit Task Title (Update)
async function updateTaskTitle(id, newTitle) {
  const trimmed = newTitle.trim();
  if (!trimmed) {
    alert("Task title cannot be empty.");
    return false;
  }
  if (trimmed.length > 100) {
    alert("Task title must be 100 characters or fewer.");
    return false;
  }

  if (isOnlineFirestore && db) {
    try {
      const taskRef = doc(db, "tasks", id);
      await updateDoc(taskRef, {
        title: trimmed
      });
      return true;
    } catch (err) {
      console.error("Error editing task:", err);
      showErrorBanner("Could not update task title.");
      return false;
    }
  } else {
    const task = tasks.find((t) => t.id === id);
    if (task) {
      task.title = trimmed;
      saveLocalTasks();
      renderTasks();
      return true;
    }
  }
  return false;
}

// 4. Delete Single Task (Delete)
async function deleteTask(id) {
  if (isOnlineFirestore && db) {
    try {
      const taskRef = doc(db, "tasks", id);
      await deleteDoc(taskRef);
    } catch (err) {
      console.error("Error deleting task:", err);
      showErrorBanner("Could not delete task from Firestore.");
    }
  } else {
    tasks = tasks.filter((t) => t.id !== id);
    saveLocalTasks();
    renderTasks();
  }
}

// 5. Clear Completed Tasks (Stretch Goal / Bulk Delete)
async function clearCompletedTasks() {
  const completedTasks = tasks.filter((t) => t.completed);
  if (completedTasks.length === 0) return;

  const confirmBulk = window.confirm(
    `Are you sure you want to delete all ${completedTasks.length} completed task(s)?`
  );
  if (!confirmBulk) return;

  if (isOnlineFirestore && db) {
    try {
      const batch = writeBatch(db);
      completedTasks.forEach((t) => {
        const taskRef = doc(db, "tasks", t.id);
        batch.delete(taskRef);
      });
      await batch.commit();
    } catch (err) {
      console.error("Error clearing completed tasks:", err);
      showErrorBanner("Failed to clear completed tasks.");
    }
  } else {
    tasks = tasks.filter((t) => !t.completed);
    saveLocalTasks();
    renderTasks();
  }
}

// ==========================================================================
// Rendering Engine (Uses textContent to prevent XSS injection attacks)
// ==========================================================================
function renderTasks() {
  updateTaskCounter();

  const filteredTasks = tasks.filter((task) => {
    if (currentFilter === "active") return !task.completed;
    if (currentFilter === "completed") return task.completed;
    return true;
  });

  if (filteredTasks.length === 0) {
    taskList.innerHTML = "";
    emptyState.classList.remove("hidden");
    if (currentFilter === "active") {
      emptyTitle.textContent = "No active tasks";
      emptyHint.textContent = "Great job! All your tasks are completed.";
    } else if (currentFilter === "completed") {
      emptyTitle.textContent = "No completed tasks";
      emptyHint.textContent = "Tasks marked as done will appear here.";
    } else {
      emptyTitle.textContent = "No tasks yet";
      emptyHint.textContent = "Add a task above to get started!";
    }
    return;
  }

  emptyState.classList.add("hidden");
  taskList.innerHTML = "";

  const fragment = document.createDocumentFragment();

  filteredTasks.forEach((task) => {
    const li = document.createElement("li");
    li.className = `task-item ${task.completed ? "completed" : ""}`;
    li.dataset.id = task.id;

    const taskLeft = document.createElement("div");
    taskLeft.className = "task-left";

    const checkboxLabel = document.createElement("label");
    checkboxLabel.className = "task-checkbox-label";
    checkboxLabel.setAttribute("aria-label", `Mark "${task.title}" as ${task.completed ? "incomplete" : "complete"}`);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-checkbox";
    checkbox.checked = Boolean(task.completed);
    checkbox.setAttribute("aria-label", `Status for: ${task.title}`);

    checkboxLabel.appendChild(checkbox);

    const titleSpan = document.createElement("span");
    titleSpan.className = "task-title";
    titleSpan.textContent = task.title;
    titleSpan.title = "Click Edit or double-click text to modify";

    taskLeft.appendChild(checkboxLabel);
    taskLeft.appendChild(titleSpan);

    const taskActions = document.createElement("div");
    taskActions.className = "task-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "action-btn action-btn-edit";
    editBtn.textContent = "Edit";
    editBtn.setAttribute("aria-label", `Edit task "${task.title}"`);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "action-btn action-btn-delete";
    deleteBtn.textContent = "Delete";
    deleteBtn.setAttribute("aria-label", `Delete task "${task.title}"`);

    taskActions.appendChild(editBtn);
    taskActions.appendChild(deleteBtn);

    li.appendChild(taskLeft);
    li.appendChild(taskActions);
    fragment.appendChild(li);
  });

  taskList.appendChild(fragment);
}

// ==========================================================================
// Inline Editing View Switcher
// ==========================================================================
function enterEditMode(li, taskId, currentTitle) {
  li.classList.add("editing");
  li.innerHTML = "";

  const form = document.createElement("form");
  form.className = "edit-form";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "edit-input";
  input.value = currentTitle;
  input.maxLength = 100;
  input.setAttribute("aria-label", "Edit task title");

  const actions = document.createElement("div");
  actions.className = "edit-actions";

  const saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.className = "edit-btn-save";
  saveBtn.textContent = "Save";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "edit-btn-cancel";
  cancelBtn.textContent = "Cancel";

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);

  form.appendChild(input);
  form.appendChild(actions);
  li.appendChild(form);

  input.focus();
  input.select();

  cancelBtn.addEventListener("click", () => {
    renderTasks();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      renderTasks();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newTitle = input.value.trim();
    if (!newTitle) {
      alert("Title cannot be empty.");
      return;
    }
    const success = await updateTaskTitle(taskId, newTitle);
    if (success) {
      renderTasks();
    }
  });
}

// ==========================================================================
// Event Listeners & Delegation
// ==========================================================================

// Form Submission
taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = taskInput.value;
  const success = await addTask(title);
  if (success) {
    taskInput.value = "";
    taskInput.focus();
  }
});

// Clear validation error on typing
taskInput.addEventListener("input", () => {
  if (formError.textContent) {
    clearInputError();
  }
});

// Event Delegation for Task List
taskList.addEventListener("click", (e) => {
  const target = e.target;
  const li = target.closest(".task-item");
  if (!li) return;
  const taskId = li.dataset.id;
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;

  if (target.classList.contains("task-checkbox")) {
    toggleTask(taskId, task.completed);
    return;
  }

  if (target.classList.contains("action-btn-edit")) {
    enterEditMode(li, taskId, task.title);
    return;
  }

  if (target.classList.contains("action-btn-delete")) {
    pendingDeleteId = taskId;
    if (typeof deleteDialog.showModal === "function") {
      deleteDialog.showModal();
    } else {
      if (window.confirm("Are you sure you want to delete this task?")) {
        deleteTask(taskId);
      }
    }
    return;
  }
});

// Double click on title to edit
taskList.addEventListener("dblclick", (e) => {
  if (e.target.classList.contains("task-title")) {
    const li = e.target.closest(".task-item");
    if (li) {
      const taskId = li.dataset.id;
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        enterEditMode(li, taskId, task.title);
      }
    }
  }
});

// Delete Confirmation Dialog Actions
dialogCancelBtn.addEventListener("click", () => {
  pendingDeleteId = null;
  deleteDialog.close();
});

dialogConfirmBtn.addEventListener("click", async () => {
  if (pendingDeleteId) {
    await deleteTask(pendingDeleteId);
    pendingDeleteId = null;
  }
  deleteDialog.close();
});

// Filter Buttons
filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterButtons.forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-pressed", "false");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-pressed", "true");
    currentFilter = btn.dataset.filter;
    renderTasks();
  });
});

// Clear Completed Tasks Button
clearCompletedBtn.addEventListener("click", () => {
  clearCompletedTasks();
});

// Retry Button on Error Banner
retryBtn.addEventListener("click", () => {
  initDataStore();
});

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initDataStore();
});
