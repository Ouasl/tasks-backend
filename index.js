const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// Swagger libraries
const swaggerUI = require("swagger-ui-express");
const swaggerJsDoc = require("swagger-jsdoc");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

// ---------------------------------------------------------------------------
// JWT SECRET
// ---------------------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET || "MY_DEMO_SECRET";
console.log("JWT_SECRET: ", JWT_SECRET);

// ---------------------------------------------------------------------------
// PATHS FOR JSON FILES
// ---------------------------------------------------------------------------
const USERS_FILE = path.join(__dirname, "users.json");
const TASKS_FILE = path.join(__dirname, "tasks.json");

// ---------------------------------------------------------------------------
// HELPER FUNCTIONS (READ/WRITE JSON FILES)
// ---------------------------------------------------------------------------
function getUsers() {
  const data = fs.readFileSync(USERS_FILE, "utf8");
  return JSON.parse(data);
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

function getTasks() {
  const data = fs.readFileSync(TASKS_FILE, "utf8");
  return JSON.parse(data);
}

function saveTasks(tasks) {
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// SWAGGER SETUP
// ---------------------------------------------------------------------------
/**
 * Swagger definitions via JSDoc comments.
 * We'll define endpoints below, so swagger-jsdoc can pick them up.
 */

console.log("process.env.SWAGGER_URL: ", process.env.SWAGGER_URL);
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Tasks API",
      version: "1.0.0",
      description: `
        \nWelcome to the Wibitech Tasks API! This API allows you to manage task. Make sure to login to use tasks API.
        \nIn order to login you can add your Token in Authorize button in the right side.`,
    },
    servers: [
      {
        url: process.env.SWAGGER_URL || "http://localhost:3000", // Change to your local or Vercel URL
        description: "Local server",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
  apis: [__filename], // This file (index.js) has the JSDoc comments
};

const swaggerSpec = swaggerJsDoc(swaggerOptions);
const swaggerCSS = `
  
`;
// Serve swagger docs at /docs
app.use(
  "/docs",
  swaggerUI.serve,
  swaggerUI.setup(swaggerSpec, {
    customCssUrl: "/swagger.css",
    customJs: "/swagger.js",
  })
);

// ---------------------------------------------------------------------------
// AUTH MIDDLEWARE
// ---------------------------------------------------------------------------
function authMiddleware(req, res, next) {
  const authHeader = req.header("Authorization");
  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const token = authHeader.replace("Bearer ", "").trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.currentUser = decoded; // e.g. { username, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.currentUser.role !== role) {
      return res.status(403).json({ error: `Requires ${role} role` });
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// PUBLIC ROUTES
// ---------------------------------------------------------------------------

app.get("/", (req, res) => {
  res.send("Welcome to the Tasks API with JWT! Visit /docs for documentation.");
});

/**
 * @swagger
 * /api/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, user]
 *                 description: "Defaults to 'user' if invalid or missing."
 *     responses:
 *       201:
 *         description: User registered
 *       409:
 *         description: Username taken
 *       422:
 *         description: Missing required fields
 */
app.post("/api/register", (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res
      .status(422)
      .json({ error: "Username and password are required." });
  }

  const validRoles = ["admin", "user"];
  const assignedRole = validRoles.includes(role) ? role : "user";

  const users = getUsers();
  if (users.some((u) => u.username === username)) {
    return res.status(409).json({ error: "Username already taken." });
  }

  const newUser = {
    username,
    password, // Not secure in real apps
    role: assignedRole,
  };
  users.push(newUser);
  saveUsers(users);

  return res.status(201).json({
    message: "User registered successfully",
    user: { username, role: assignedRole },
  });
});

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Login with username & password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Returns a JWT token
 *       401:
 *         description: Invalid credentials
 */
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const users = getUsers();

  const foundUser = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!foundUser) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Create JWT
  const token = jwt.sign(
    { username: foundUser.username, role: foundUser.role },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  return res.json({ token });
});

// ---------------------------------------------------------------------------
// PROTECTED ROUTES (Auth Required)
// ---------------------------------------------------------------------------
const router = express.Router();
router.use(authMiddleware);

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: Get tasks
 *     tags: [Tasks (Auth Required)]
 *     security:
 *       - BearerAuth: []
 *     description: |
 *       - **Admin**: retrieves all tasks.
 *       - **Regular user**: retrieves only tasks assigned to them.
 *     responses:
 *       200:
 *         description: Returns an array of tasks
 *       401:
 *         description: Invalid/missing token
 */
router.get("/tasks", (req, res) => {
  const tasks = getTasks();
  const { role, username } = req.currentUser;

  if (role === "admin") {
    return res.json(tasks);
  } else {
    const userTasks = tasks.filter((t) => t.assignedTo === username);
    return res.json(userTasks);
  }
});

/**
 * @swagger
 * /api/tasks/{id}:
 *   get:
 *     summary: Get a specific task
 *     tags: [Tasks (Auth Required)]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Numeric ID of the task
 *     description: |
 *       - **Admin**: can see any task.
 *       - **User**: can only see tasks assigned to them.
 *     responses:
 *       200:
 *         description: A single task object
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Not allowed to view this task
 *       404:
 *         description: Task not found
 */
router.get("/tasks/:id", (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const tasks = getTasks();
  const { role, username } = req.currentUser;

  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  if (role !== "admin" && task.assignedTo !== username) {
    return res.status(403).json({ error: "Not allowed to view this task" });
  }

  return res.json(task);
});

/**
 * @swagger
 * /api/tasks:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks (Auth Required)]
 *     security:
 *       - BearerAuth: []
 *     description: Only admin can create new tasks.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - assignedTo
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 default: open
 *               assignedTo:
 *                 type: string
 *     responses:
 *       201:
 *         description: Task created
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Requires admin role
 *       422:
 *         description: Missing fields
 */
router.post("/tasks", requireRole("admin"), (req, res) => {
  const { title, description, status, assignedTo } = req.body;
  if (!title || !description || !assignedTo) {
    return res.status(422).json({
      error: "Missing required fields: title, description, assignedTo.",
    });
  }

  const tasks = getTasks();
  const newId = tasks.length ? tasks[tasks.length - 1].id + 1 : 1;

  const newTask = {
    id: newId,
    title,
    description,
    status: status || "open",
    assignedTo,
  };

  tasks.push(newTask);
  saveTasks(tasks);

  return res.status(201).json(newTask);
});

/**
 * @swagger
 * /api/tasks/{id}:
 *   put:
 *     summary: Update a task
 *     tags: [Tasks (Auth Required)]
 *     security:
 *       - BearerAuth: []
 *     description: |
 *       - **Admin**: can update any task.
 *       - **User**: can update tasks only if assigned to them (with some restrictions).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Numeric ID of the task
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *               assignedTo:
 *                 type: string
 *                 description: "Only admin can reassign tasks"
 *     responses:
 *       200:
 *         description: Updated task
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Not allowed to update
 *       404:
 *         description: Task not found
 */
router.put("/tasks/:id", (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const tasks = getTasks();
  const taskIndex = tasks.findIndex((t) => t.id === taskId);

  if (taskIndex === -1) {
    return res.status(404).json({ error: "Task not found" });
  }

  const { role, username } = req.currentUser;
  if (role !== "admin" && tasks[taskIndex].assignedTo !== username) {
    return res.status(403).json({ error: "Not allowed to update this task" });
  }

  const { title, description, status, assignedTo } = req.body;
  if (title !== undefined) tasks[taskIndex].title = title;
  if (description !== undefined) tasks[taskIndex].description = description;
  if (status !== undefined) tasks[taskIndex].status = status;

  // Only admin can reassign tasks
  if (assignedTo !== undefined && role === "admin") {
    tasks[taskIndex].assignedTo = assignedTo;
  }

  saveTasks(tasks);
  return res.json(tasks[taskIndex]);
});

/**
 * @swagger
 * /api/tasks/{id}:
 *   delete:
 *     summary: Delete a task
 *     tags: [Tasks (Auth Required)]
 *     security:
 *       - BearerAuth: []
 *     description: Only admin can delete tasks.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Numeric ID of the task
 *     responses:
 *       200:
 *         description: Task deleted
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Requires admin role
 *       404:
 *         description: Task not found
 */
router.delete("/tasks/:id", requireRole("admin"), (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const tasks = getTasks();
  const taskIndex = tasks.findIndex((t) => t.id === taskId);

  if (taskIndex === -1) {
    return res.status(404).json({ error: "Task not found" });
  }

  tasks.splice(taskIndex, 1);
  saveTasks(tasks);
  return res.json({ success: true, message: "Task deleted" });
});

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all registered users
 *     tags: [Users (Auth Required)]
 *     security:
 *       - BearerAuth: []
 *     description: Admin only. Returns an array of all users (excluding passwords).
 *     responses:
 *       200:
 *         description: An array of user objects
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Requires admin role
 */
router.get("/users", requireRole("admin"), (req, res) => {
  const users = getUsers();
  // Don't expose passwords
  const safeUsers = users.map((u) => ({
    username: u.username,
    role: u.role,
  }));
  res.json(safeUsers);
});

// Attach protected router
app.use("/api", router);

// ---------------------------------------------------------------------------
// LOCAL SERVER (For testing; not used by Vercel in production)
// ---------------------------------------------------------------------------
const port = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Swagger docs available at http://localhost:${port}/docs`);
  });
}

// Export app for Vercel
module.exports = app;
