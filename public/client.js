const taskList = document.querySelector("#task-list");
const emptyState = document.querySelector("#empty-state");
const taskDialog = document.querySelector("#task-dialog");
const taskForm = document.querySelector("#task-form");
const searchInput = document.querySelector("#search-input");
const toast = document.querySelector("#toast");

let tasks = [];
let currentView = "inbox";
let toastTimer;

const viewLabels = {
    inbox: "All tasks",
    today: "Today",
    upcoming: "Upcoming",
    completed: "Completed",
    work: "Work",
    personal: "Personal",
    ideas: "Ideas"
};

const categoryLabels = { work: "Work", personal: "Personal", ideas: "Ideas" };
const priorityOrder = { high: 0, normal: 1, low: 2 };

function localDateString(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function prettyDate(value, includeYear = false) {
    if (!value) return "No date";
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", ...(includeYear ? { year: "numeric" } : {}) })
        .format(new Date(year, month - 1, day));
}

function dueLabel(task) {
    if (!task.date) return { text: "No date", className: "" };
    const today = localDateString();
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = localDateString(tomorrowDate);
    if (task.date < today && !task.completed) return { text: `${prettyDate(task.date)} · late`, className: "is-late" };
    if (task.date === today) return { text: "Today", className: "is-today" };
    if (task.date === tomorrow) return { text: "Tomorrow", className: "" };
    return { text: prettyDate(task.date), className: "" };
}

async function api(path, options = {}) {
    const response = await fetch(path, {
        ...options,
        headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers }
    });
    if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Something went wrong. Please try again.");
    }
    return response.status === 204 ? null : response.json();
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function visibleTasks() {
    const today = localDateString();
    const query = searchInput.value.trim().toLocaleLowerCase();
    let result = tasks.filter((task) => {
        if (currentView === "today" && task.date !== today) return false;
        if (currentView === "upcoming" && (!task.date || task.date <= today || task.completed)) return false;
        if (currentView === "completed" && !task.completed) return false;
        if (["work", "personal", "ideas"].includes(currentView) && task.category !== currentView) return false;
        return !query || `${task.title} ${task.description} ${task.category}`.toLocaleLowerCase().includes(query);
    });

    const sort = document.querySelector("#sort-select").value;
    result = [...result].sort((first, second) => {
        if (first.completed !== second.completed) return Number(first.completed) - Number(second.completed);
        if (sort === "priority") return priorityOrder[first.priority] - priorityOrder[second.priority] || first.date.localeCompare(second.date);
        if (sort === "created") return second.createdAt.localeCompare(first.createdAt);
        return (first.date || "9999-99-99").localeCompare(second.date || "9999-99-99") || second.createdAt.localeCompare(first.createdAt);
    });
    return result;
}

function taskMarkup(task, index) {
    const due = dueLabel(task);
    const category = escapeHtml(task.category);
    const priority = escapeHtml(task.priority);
    return `<article class="task-row${task.completed ? " is-complete" : ""}" style="animation-delay:${Math.min(index * 35, 210)}ms" data-task-id="${escapeHtml(task.id)}">
        <button class="task-check" type="button" aria-label="Mark ${escapeHtml(task.title)} ${task.completed ? "incomplete" : "complete"}" aria-pressed="${task.completed}" data-action="toggle"><span aria-hidden="true">&#10003;</span></button>
        <div class="task-main"><p class="task-title">${escapeHtml(task.title)}</p>${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ""}</div>
        <div class="task-meta"><span class="task-date ${due.className}">${escapeHtml(due.text)}</span><span class="task-tag"><i class="category-dot dot-${category}"></i>${escapeHtml(categoryLabels[task.category] || task.category)}</span><span class="priority-label"><i class="priority-dot ${priority}"></i>${priority}</span><button class="delete-task" type="button" aria-label="Delete ${escapeHtml(task.title)}" title="Delete task" data-action="delete">&times;</button></div>
    </article>`;
}

function renderCounts() {
    const pending = tasks.filter((task) => !task.completed);
    const today = localDateString();
    const todaysTasks = tasks.filter((task) => task.date === today);
    const todaysDone = todaysTasks.filter((task) => task.completed).length;
    const counts = {
        inbox: pending.length,
        today: tasks.filter((task) => task.date === today && !task.completed).length,
        upcoming: tasks.filter((task) => task.date > today && !task.completed).length,
        completed: tasks.filter((task) => task.completed).length,
        work: pending.filter((task) => task.category === "work").length,
        personal: pending.filter((task) => task.category === "personal").length,
        ideas: pending.filter((task) => task.category === "ideas").length
    };
    for (const [view, count] of Object.entries(counts)) {
        document.querySelector(`#count-${view}`).textContent = count;
    }
    document.querySelector("#summary-open").textContent = pending.length;
    document.querySelector("#summary-today").textContent = counts.today;
    document.querySelector("#progress-text").textContent = `${todaysDone} / ${todaysTasks.length}`;
    document.querySelector("#progress-fill").style.width = `${todaysTasks.length ? (todaysDone / todaysTasks.length) * 100 : 0}%`;
}

function renderTasks() {
    const filtered = visibleTasks();
    taskList.innerHTML = filtered.map(taskMarkup).join("");
    const isEmpty = filtered.length === 0;
    emptyState.hidden = !isEmpty;
    taskList.hidden = isEmpty;
    document.querySelector("#quick-add").hidden = currentView === "completed";
    document.querySelector("#result-count").textContent = `${filtered.length} ${filtered.length === 1 ? "ITEM" : "ITEMS"}`;
    renderCounts();
}

function setView(view) {
    currentView = view;
    document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
    document.querySelector("#current-view-label").textContent = viewLabels[view].toLocaleUpperCase();
    document.querySelector("#task-section-title").textContent = viewLabels[view];
    renderTasks();
}

function openTaskDialog() {
    document.querySelector("#form-error").textContent = "";
    taskDialog.showModal();
    document.querySelector("#task-title").focus();
}

function closeTaskDialog() {
    taskDialog.close();
    taskForm.reset();
}

async function loadTasks() {
    try {
        tasks = await api("/api/tasks");
        renderTasks();
    } catch (error) {
        showToast(error.message);
        taskList.innerHTML = "<p class='task-description'>Couldn't load your tasks. Refresh to try again.</p>";
    }
}

function setDateLabels() {
    const now = new Date();
    const longDate = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(now);
    document.querySelector("#today-label").textContent = longDate.toLocaleUpperCase();
    document.querySelector("#sidebar-date").textContent = longDate;
    document.querySelector("#footer-date").textContent = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(now).toLocaleUpperCase();
}

document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
document.querySelector("#open-task-form").addEventListener("click", openTaskDialog);
document.querySelector("#quick-add").addEventListener("click", openTaskDialog);
document.querySelector("#empty-add-task").addEventListener("click", openTaskDialog);
document.querySelector("#close-dialog").addEventListener("click", closeTaskDialog);
document.querySelector("#cancel-dialog").addEventListener("click", closeTaskDialog);
searchInput.addEventListener("input", renderTasks);
document.querySelector("#sort-select").addEventListener("change", renderTasks);

taskDialog.addEventListener("click", (event) => {
    if (event.target === taskDialog) closeTaskDialog();
});

taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(taskForm);
    const task = {
        title: formData.get("title"),
        description: formData.get("description"),
        date: formData.get("date"),
        category: formData.get("category"),
        priority: formData.get("priority")
    };
    try {
        const created = await api("/api/tasks", { method: "POST", body: JSON.stringify(task) });
        tasks.unshift(created);
        closeTaskDialog();
        if (currentView === "completed") setView("inbox");
        else renderTasks();
        showToast("Added to your list.");
    } catch (error) {
        document.querySelector("#form-error").textContent = error.message;
    }
});

taskList.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const row = actionButton.closest("[data-task-id]");
    const task = tasks.find((item) => item.id === row.dataset.taskId);
    if (!task) return;

    if (actionButton.dataset.action === "delete" && !window.confirm(`Delete “${task.title}”?`)) return;
    try {
        if (actionButton.dataset.action === "toggle") {
            const updated = await api(`/api/tasks/${encodeURIComponent(task.id)}`, { method: "PATCH", body: JSON.stringify({ completed: !task.completed }) });
            tasks = tasks.map((item) => item.id === updated.id ? updated : item);
            renderTasks();
            showToast(updated.completed ? "One thing, done." : "Back on your list.");
        } else if (actionButton.dataset.action === "delete") {
            await api(`/api/tasks/${encodeURIComponent(task.id)}`, { method: "DELETE" });
            tasks = tasks.filter((item) => item.id !== task.id);
            renderTasks();
            showToast("Task removed.");
        }
    } catch (error) {
        showToast(error.message);
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
        event.preventDefault();
        searchInput.focus();
    }
});

setDateLabels();
loadTasks();