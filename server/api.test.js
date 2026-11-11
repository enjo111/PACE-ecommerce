import { test, after } from "node:test";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.DB_PATH = ":memory:";
const { app, db } = await import("./index.js");
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const base = "http://127.0.0.1:" + server.address().port;
async function request(route, body, cookie, method) {
  const res = await fetch(base + "/api" + route, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: res.status,
    data: await res.json(),
    cookie: res.headers.get("set-cookie")?.split(";")[0],
  };
}
after(() => {
  server.close();
  db.close();
});
test("catalog exposes seeded products and category filters", async () => {
  const r = await request("/products");
  assert.equal(r.status, 200);
  assert.equal(r.data.length, 8);
  const shoes = await request("/products?category=Footwear");
  assert.equal(shoes.data.length, 3);
});
test("checkout recalculates prices and reduces stock, rejects invalid variants and overselling", async () => {
  const before = (await request("/products")).data[0];
  const payload = {
    name: "Demo Runner",
    email: "demo@example.com",
    address: "1 Sample Street, Test City",
    items: [{ id: 1, size: "9", color: "Chalk", quantity: 2, price: 1 }],
    total: 1,
  };
  const r = await request("/orders", payload);
  assert.equal(r.status, 201);
  assert.equal(r.data.total, 29600);
  const after = (await request("/products")).data[0];
  assert.equal(after.stock, before.stock - 2);
  const invalid = await request("/orders", {
    ...payload,
    items: [{ id: 1, size: "impossible", color: "Chalk", quantity: 1 }],
  });
  assert.equal(invalid.status, 400);
  const tooMany = await request("/orders", {
    ...payload,
    items: [
      { id: 1, size: "9", color: "Chalk", quantity: 10 },
      { id: 1, size: "10", color: "Chalk", quantity: 10 },
      { id: 1, size: "11", color: "Chalk", quantity: 10 },
    ],
  });
  assert.equal(tooMany.status, 400);
  assert.equal((await request("/products")).data[0].stock, after.stock);
});
test("customer account order history is isolated and logout invalidates session", async () => {
  const r = await request("/auth/register", {
    name: "Alex",
    email: "alex@example.com",
    password: "TrainingDay!26",
  });
  assert.equal(r.status, 201);
  assert.ok(r.cookie);
  assert.equal((await request("/orders", undefined, r.cookie)).data.length, 0);
  const o = await request(
    "/orders",
    {
      name: "Alex",
      email: "alex@example.com",
      address: "2 Demo Road",
      items: [{ id: 2, size: "M", color: "Sage", quantity: 1 }],
    },
    r.cookie,
  );
  assert.equal(o.status, 201);
  assert.equal(o.data.total, 5600);
  assert.equal((await request("/orders", undefined, r.cookie)).data.length, 1);
  const other = await request("/auth/register", {
    name: "Other",
    email: "other@example.com",
    password: "TrainingDay!26",
  });
  assert.equal(
    (await request("/orders", undefined, other.cookie)).data.length,
    0,
  );
  assert.equal(
    (await request("/admin/orders", undefined, r.cookie)).status,
    403,
  );
  await request("/auth/logout", {}, r.cookie);
  assert.equal((await request("/orders", undefined, r.cookie)).status, 401);
});
test("admin operations require role and validate product data", async () => {
  assert.equal((await request("/admin/products", {})).status, 403);
  const r = await request("/auth/login", {
    email: "admin@pace.demo",
    password: "PaceStudio!2026",
  });
  assert.equal(r.status, 200);
  const orders = await request("/admin/orders", undefined, r.cookie);
  assert.ok(orders.data.length >= 2);
  const id = orders.data[0].id;
  assert.equal(
    (
      await request(
        "/admin/orders/" + id,
        { status: "Shipped" },
        r.cookie,
        "PATCH",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/admin/orders/" + id,
        { status: "Fake" },
        r.cookie,
        "PATCH",
      )
    ).status,
    400,
  );
  const p = (await request("/products")).data[0];
  assert.equal(
    (await request("/admin/products", { ...p, price: -1 }, r.cookie)).status,
    400,
  );
  const created = await request(
    "/admin/products",
    { ...p, name: "Test Essential", stock: 5 },
    r.cookie,
  );
  assert.equal(created.status, 201);
  assert.equal(
    (
      await request(
        "/admin/products/" + created.data.id,
        { ...created.data, stock: 0 },
        r.cookie,
        "PUT",
      )
    ).status,
    200,
  );
});
test("malformed requests fail without creating orders and origin checks reject foreign writes", async () => {
  assert.equal((await request("/orders", { name: "", items: [] })).status, 400);
  const r = await fetch(base + "/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://foreign.invalid",
    },
    body: "{}",
  });
  assert.equal(r.status, 403);
});
