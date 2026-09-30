const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const app = express();
const port = process.env.PORT || 3000;
const dataDirectory = path.join(__dirname, "data");
const dataFile = path.join(dataDirectory, "tasks.json");
const allowedPriorities = new Set(["low", "normal", "high"]);
const allowedCategories = new Set(["work", "personal", "ideas"]);

function dateOffset(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function loadTasks() {
    fs.mkdirSync(dataDirectory, { recursive: true });
    if (!fs.existsSync(dataFile)) {
        const initialTasks = [
            { id: randomUUID(), title: "Review the launch brief", description: "Pull out the decisions we need to make this week.", date: dateOffset(0), priority: "high", category: "work", completed: false, createdAt: new Date().toISOString() },
            { id: randomUUID(), title: "Sketch the onboarding flow", description: "Keep the first session calm, clear, and useful.", date: dateOffset(0), priority: "normal", category: "work", completed: false, createdAt: new Date().toISOString() },
            { id: randomUUID(), title: "Pick up something for dinner", description: "A small thing, then call it a day.", date: dateOffset(1), priority: "low", category: "personal", completed: false, createdAt: new Date().toISOString() },
            { id: randomUUID(), title: "Capture the reading list idea", description: "A short list of things worth returning to.", date: "", priority: "normal", category: "ideas", completed: true, createdAt: new Date().toISOString() }
        ];
        fs.writeFileSync(dataFile, JSON.stringify(initialTasks, null, 2));
    }
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
}

let tasks = loadTasks();

function saveTasks() {
    const temporaryFile = `${dataFile}.tmp`;
    fs.writeFileSync(temporaryFile, JSON.stringify(tasks, null, 2));
    fs.renameSync(temporaryFile, dataFile);
}

app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/tasks", (req, res) => {
    res.json(tasks);
});

app.post("/api/tasks", (req, res) => {
    const { title, description = "", date = "", priority = "normal", category = "work" } = req.body;
    if (typeof title !== "string" || !title.trim() || title.trim().length > 160) {
        return res.status(400).json({ error: "A title of 1 to 160 characters is required." });
    }
    if (typeof description !== "string" || description.length > 500 || !allowedPriorities.has(priority) || !allowedCategories.has(category) || (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
        return res.status(400).json({ error: "Please check the task details and try again." });
    }

    const task = { id: randomUUID(), title: title.trim(), description: description.trim(), date, priority, category, completed: false, createdAt: new Date().toISOString() };
    tasks.unshift(task);
    saveTasks();
    res.status(201).json(task);
});

app.patch("/api/tasks/:id", (req, res) => {
    const task = tasks.find((item) => item.id === req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found." });

    const { title, description, date, priority, category, completed } = req.body;
    if ((title !== undefined && (typeof title !== "string" || !title.trim() || title.trim().length > 160)) ||
        (description !== undefined && (typeof description !== "string" || description.length > 500)) ||
        (date !== undefined && (typeof date !== "string" || (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)))) ||
        (priority !== undefined && !allowedPriorities.has(priority)) ||
        (category !== undefined && !allowedCategories.has(category)) ||
        (completed !== undefined && typeof completed !== "boolean")) {
        return res.status(400).json({ error: "Please check the task details and try again." });
    }

    if (title !== undefined) task.title = title.trim();
    if (description !== undefined) task.description = description.trim();
    if (date !== undefined) task.date = date;
    if (priority !== undefined) task.priority = priority;
    if (category !== undefined) task.category = category;
    if (completed !== undefined) task.completed = completed;
    saveTasks();
    res.json(task);
});

app.delete("/api/tasks/:id", (req, res) => {
    const nextTasks = tasks.filter((task) => task.id !== req.params.id);
    if (nextTasks.length === tasks.length) return res.status(404).json({ error: "Task not found." });
    tasks = nextTasks;
    saveTasks();
    res.status(204).end();
});

app.listen(port, () => {
    console.log(`Daymark is running at http://localhost:${port}`);
});