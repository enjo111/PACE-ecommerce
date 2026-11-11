import express from "express";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { products } from "./seed.js";

const root = fileURLToPath(new URL("../", import.meta.url));
mkdirSync(path.join(root, "data"), { recursive: true });
export const db = new DatabaseSync(
  process.env.DB_PATH || path.join(root, "data/pace.db"),
);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY, payload TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, hash TEXT NOT NULL, salt TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer');
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), expires INTEGER);
 CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), email TEXT NOT NULL, name TEXT NOT NULL, address TEXT NOT NULL, items TEXT NOT NULL, total INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'Processing', created TEXT NOT NULL);
`);
if (!db.prepare("SELECT id FROM products LIMIT 1").get())
  for (const p of products)
    db.prepare("INSERT INTO products VALUES(?,?)").run(p.id, JSON.stringify(p));
// Upgrade the initial demo catalog to bundled photos without changing inventory.
for (const row of db.prepare("SELECT id,payload FROM products").all()) {
  const p = JSON.parse(row.payload);
  if (p.id <= 8 && p.image.startsWith("https://images.unsplash.com/")) {
    p.image = `/images/product${p.id}.jpg`;
    db.prepare("UPDATE products SET payload=? WHERE id=?").run(
      JSON.stringify(p),
      row.id,
    );
  }
}
const hash = (password, salt) => scryptSync(password, salt, 64).toString("hex");
function createUser(name, email, password, role = "customer") {
  const salt = randomBytes(16).toString("hex");
  return db
    .prepare("INSERT INTO users(name,email,hash,salt,role) VALUES(?,?,?,?,?)")
    .run(name, email, hash(password, salt), salt, role);
}
if (!db.prepare("SELECT id FROM users WHERE role=?").get("admin"))
  createUser(
    "PACE Studio",
    "admin@pace.demo",
    process.env.ADMIN_PASSWORD || "PaceStudio!2026",
    "admin",
  );
export const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "50kb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  const origin = req.headers.origin;
  if (
    origin &&
    ![
      process.env.CLIENT_URL,
      "http://127.0.0.1:5174",
      "http://localhost:5174",
      `http://${req.headers.host}`,
      ...(process.env.NODE_ENV === "production"
        ? [`https://${req.headers.host}`]
        : []),
    ].includes(origin)
  )
    return res.status(403).json({ error: "Origin not allowed" });
  next();
});
const attempts = new Map();
app.use("/api/auth", (req, res, next) => {
  const key = req.ip,
    now = Date.now();
  let a = attempts.get(key);
  if (!a || now > a.until) {
    a = { count: 0, until: now + 60000 };
    attempts.set(key, a);
  }
  if (++a.count > 30)
    return res
      .status(429)
      .json({ error: "Too many attempts. Try again in a minute." });
  next();
});
app.use((req, res, next) => {
  const token = req.headers.cookie
    ?.split("; ")
    .find((c) => c.startsWith("pace_session="))
    ?.split("=")[1];
  if (token)
    req.user = db
      .prepare(
        "SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
      )
      .get(token, Date.now());
  next();
});
const auth = (req, res, next) =>
  req.user ? next() : res.status(401).json({ error: "Please sign in first." });
const admin = (req, res, next) =>
  req.user?.role === "admin"
    ? next()
    : res.status(403).json({ error: "Admin access required." });
const getProducts = () =>
  db
    .prepare("SELECT payload FROM products")
    .all()
    .map((p) => JSON.parse(p.payload));
const text = (s, max = 200) =>
  typeof s === "string" && s.trim().length > 0 && s.trim().length <= max;
const emailOK = (s) =>
  typeof s === "string" &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) &&
  s.length <= 254;
function session(res, id) {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
    token,
    id,
    Date.now() + 7 * 86400000,
  );
  res.setHeader(
    "Set-Cookie",
    `pace_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
}
app.get("/api/health", (_, res) => res.json({ ok: true }));
app.get("/api/products", (req, res) => {
  let list = getProducts();
  if (req.query.category)
    list = list.filter((p) => p.category === req.query.category);
  if (req.query.q)
    list = list.filter((p) =>
      p.name.toLowerCase().includes(String(req.query.q).toLowerCase()),
    );
  res.json(list);
});
app.get("/api/auth/me", (req, res) => res.json(req.user || null));
app.post("/api/auth/register", (req, res) => {
  const { name, email, password } = req.body;
  if (
    !text(name, 80) ||
    !emailOK(email) ||
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 128
  )
    return res
      .status(400)
      .json({
        error: "Enter a name, valid email and password of 10–128 characters.",
      });
  try {
    const u = createUser(name.trim(), email.toLowerCase().trim(), password);
    session(res, Number(u.lastInsertRowid));
    res
      .status(201)
      .json({
        id: Number(u.lastInsertRowid),
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role: "customer",
      });
  } catch (e) {
    if (e.code?.includes("SQLITE"))
      return res
        .status(409)
        .json({ error: "An account with that email already exists." });
    throw e;
  }
});
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!emailOK(email) || typeof password !== "string" || password.length > 128)
    return res.status(400).json({ error: "Enter your email and password." });
  const u = db
    .prepare("SELECT * FROM users WHERE email=?")
    .get(email.toLowerCase().trim());
  if (
    !u ||
    !timingSafeEqual(
      Buffer.from(u.hash, "hex"),
      Buffer.from(hash(password, u.salt), "hex"),
    )
  )
    return res.status(401).json({ error: "Email or password is incorrect." });
  session(res, u.id);
  res.json({ id: u.id, name: u.name, email: u.email, role: u.role });
});
app.post("/api/auth/logout", (req, res) => {
  const token = req.headers.cookie
    ?.split("; ")
    .find((c) => c.startsWith("pace_session="))
    ?.split("=")[1];
  if (token) db.prepare("DELETE FROM sessions WHERE token=?").run(token);
  res.setHeader(
    "Set-Cookie",
    "pace_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
  );
  res.json({ ok: true });
});
app.post("/api/orders", (req, res) => {
  const { name, email, address, items } = req.body;
  if (
    !text(name, 80) ||
    !emailOK(email) ||
    !text(address, 500) ||
    !Array.isArray(items) ||
    !items.length ||
    items.length > 30
  )
    return res
      .status(400)
      .json({
        error: "Complete your delivery details and add an item to your bag.",
      });
  db.exec("BEGIN IMMEDIATE");
  try {
    const catalog = getProducts(),
      lines = [],
      counts = new Map();
    for (const line of items) {
      const p = catalog.find((p) => p.id === line.id);
      if (
        !p ||
        !Number.isInteger(line.quantity) ||
        line.quantity < 1 ||
        line.quantity > 10 ||
        !p.sizes.includes(line.size) ||
        !p.colors.includes(line.color)
      )
        throw Error("An item or variant is invalid. Review your bag.");
      counts.set(p.id, (counts.get(p.id) || 0) + line.quantity);
      lines.push({
        id: p.id,
        name: p.name,
        price: p.price,
        image: p.image,
        size: line.size,
        color: line.color,
        quantity: line.quantity,
      });
    }
    for (const [id, quantity] of counts) {
      const p = catalog.find((p) => p.id === id);
      if (quantity > p.stock)
        throw Error(`${p.name} has only ${p.stock} left. Update your bag.`);
      p.stock -= quantity;
      db.prepare("UPDATE products SET payload=? WHERE id=?").run(
        JSON.stringify(p),
        id,
      );
    }
    const subtotal = lines.reduce(
        (s, l) => s + Math.round(l.price * 100) * l.quantity,
        0,
      ),
      total = subtotal + (subtotal >= 15000 ? 0 : 800),
      id = "PC-" + randomBytes(5).toString("hex").toUpperCase();
    db.prepare(
      "INSERT INTO orders(id,user_id,email,name,address,items,total,created) VALUES(?,?,?,?,?,?,?,?)",
    ).run(
      id,
      req.user?.id || null,
      email.trim().toLowerCase(),
      name.trim(),
      address.trim(),
      JSON.stringify(lines),
      total,
      new Date().toISOString(),
    );
    db.exec("COMMIT");
    res.status(201).json({ id, total, status: "Processing" });
  } catch (e) {
    db.exec("ROLLBACK");
    res.status(400).json({ error: e.message });
  }
});
app.get("/api/orders", auth, (req, res) =>
  res.json(
    db
      .prepare("SELECT * FROM orders WHERE user_id=? ORDER BY created DESC")
      .all(req.user.id)
      .map((o) => ({ ...o, items: JSON.parse(o.items) })),
  ),
);
app.get("/api/admin/orders", admin, (_, res) =>
  res.json(
    db
      .prepare("SELECT * FROM orders ORDER BY created DESC")
      .all()
      .map((o) => ({ ...o, items: JSON.parse(o.items) })),
  ),
);
app.patch("/api/admin/orders/:id", admin, (req, res) => {
  if (!["Processing", "Shipped", "Delivered"].includes(req.body.status))
    return res.status(400).json({ error: "Invalid status." });
  const result = db
    .prepare("UPDATE orders SET status=? WHERE id=?")
    .run(req.body.status, req.params.id);
  if (!result.changes)
    return res.status(404).json({ error: "Order not found." });
  res.json({ ok: true });
});
function validProduct(p) {
  return (
    text(p.name, 100) &&
    ["Footwear", "Tops", "Bottoms", "Accessories"].includes(p.category) &&
    typeof p.price === "number" &&
    p.price >= 1 &&
    p.price <= 10000 &&
    Number.isInteger(p.stock) &&
    p.stock >= 0 &&
    p.stock <= 100000 &&
    text(p.description, 1500) &&
    Array.isArray(p.sizes) &&
    p.sizes.length > 0 &&
    p.sizes.length <= 15 &&
    p.sizes.every((s) => text(s, 20)) &&
    Array.isArray(p.colors) &&
    p.colors.length > 0 &&
    p.colors.length <= 12 &&
    p.colors.every((s) => text(s, 30)) &&
    typeof p.image === "string" &&
    p.image.length < 2000 &&
    /^(https:\/\/|\/images\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$)/.test(p.image) &&
    (!p.badge || text(p.badge, 30))
  );
}
app.post("/api/admin/products", admin, (req, res) => {
  if (!validProduct(req.body))
    return res
      .status(400)
      .json({
        error:
          "Check product fields. Use an HTTPS image, positive price, sizes, colors and nonnegative stock.",
      });
  const id = Number(
      db.prepare("SELECT COALESCE(MAX(id),0)+1 AS id FROM products").get().id,
    ),
    p = { ...req.body, id };
  db.prepare("INSERT INTO products VALUES(?,?)").run(id, JSON.stringify(p));
  res.status(201).json(p);
});
app.put("/api/admin/products/:id", admin, (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare("SELECT id FROM products WHERE id=?").get(id))
    return res.status(404).json({ error: "Product not found." });
  if (!validProduct(req.body))
    return res.status(400).json({ error: "Check product fields." });
  const p = { ...req.body, id };
  db.prepare("UPDATE products SET payload=? WHERE id=?").run(
    JSON.stringify(p),
    id,
  );
  res.json(p);
});
app.use("/api", (_, res) =>
  res.status(404).json({ error: "API route not found." }),
);
app.use(express.static(path.join(root, "dist")));
app.get("/{*path}", (_, res) =>
  res.sendFile(path.join(root, "dist/index.html")),
);
app.use((err, req, res, next) => {
  console.error(err.message);
  res
    .status(err.status === 400 ? 400 : 500)
    .json({
      error:
        err.status === 400
          ? "Invalid request body."
          : "Something went wrong. Please try again.",
    });
});
if (process.env.NODE_ENV !== "test")
  app.listen(Number(process.env.PORT || 3002), "127.0.0.1", () =>
    console.log("PACE API: http://127.0.0.1:" + (process.env.PORT || 3002)),
  );
