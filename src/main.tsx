import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  ShoppingBag,
  UserRound,
  X,
  Plus,
  Minus,
  Check,
  Menu,
  SlidersHorizontal,
  Truck,
  ShieldCheck,
  RefreshCw,
  ChevronDown,
  LogOut,
  Package,
  LayoutDashboard,
  Heart,
} from "lucide-react";
import "./style.css";

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string;
  sizes: string[];
  colors: string[];
  image: string;
  badge: string;
  stock: number;
};
type Line = { id: number; size: string; color: string; quantity: number };
type User = { id: number; name: string; email: string; role: string };
type Order = {
  id: string;
  name: string;
  email: string;
  address: string;
  total: number;
  status: string;
  created: string;
  items: (Line & { name: string; price: number })[];
};
async function api<T>(
  url: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const r = await fetch("/api" + url, {
    method: method || (body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Could not complete request.");
  return data;
}
const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
const categories = ["All gear", "Footwear", "Tops", "Bottoms", "Accessories"];
function App() {
  const [products, setProducts] = useState<Product[]>([]),
    [user, setUser] = useState<User | null>(null),
    [page, setPage] = useState(
      location.hash === "#admin"
        ? "admin"
        : location.hash === "#shop"
          ? "shop"
          : "home",
    ),
    [category, setCategory] = useState("All gear"),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("Featured"),
    [sizeFilter, setSizeFilter] = useState("All sizes"),
    [maxPrice, setMaxPrice] = useState(200),
    [showFilters, setShowFilters] = useState(false),
    [bag, setBag] = useState<Line[]>(() => {
      try {
        const b = JSON.parse(localStorage.getItem("pace-bag") || "[]");
        return Array.isArray(b)
          ? b.filter(
              (l) =>
                Number.isInteger(l.id) &&
                typeof l.size === "string" &&
                typeof l.color === "string" &&
                Number.isInteger(l.quantity) &&
                l.quantity > 0 &&
                l.quantity <= 10,
            )
          : [];
      } catch {
        return [];
      }
    }),
    [panel, setPanel] = useState(""),
    [selected, setSelected] = useState<Product | null>(null),
    [size, setSize] = useState(""),
    [color, setColor] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [authMode, setAuthMode] = useState("login"),
    [order, setOrder] = useState<{ id: string; total: number } | null>(null),
    [orders, setOrders] = useState<Order[]>([]),
    [editing, setEditing] = useState<Product | null>(null),
    [adminTab, setAdminTab] = useState("overview"),
    [mobile, setMobile] = useState(false),
    [wish, setWish] = useState<number[]>(() => {
      try {
        return JSON.parse(localStorage.getItem("pace-wish") || "[]");
      } catch {
        return [];
      }
    });
  const refresh = () => api<Product[]>("/products").then(setProducts);
  useEffect(() => {
    Promise.all([refresh(), api<User | null>("/auth/me").then(setUser)])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    const h = () => {
      setPage(
        location.hash === "#admin"
          ? "admin"
          : location.hash === "#shop"
            ? "shop"
            : "home",
      );
      setMobile(false);
      window.scrollTo(0, 0);
    };
    addEventListener("hashchange", h);
    return () => removeEventListener("hashchange", h);
  }, []);
  useEffect(() => localStorage.setItem("pace-bag", JSON.stringify(bag)), [bag]);
  useEffect(
    () => localStorage.setItem("pace-wish", JSON.stringify(wish)),
    [wish],
  );
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 3500);
      return () => clearTimeout(t);
    }
  }, [notice]);
  useEffect(() => {
    const opened = Boolean(panel || selected || editing);
    document.body.style.overflow = opened ? "hidden" : "";
    const previous = document.activeElement as HTMLElement | null;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPanel("");
        setSelected(null);
        setEditing(null);
      }
      if (e.key === "Tab" && opened) {
        const focusable = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".modal button:not(:disabled),.modal input,.modal select,.modal textarea,.modal a[href],.modal summary",
          ),
        ).filter((el) => el.getClientRects().length > 0);
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = "";
      removeEventListener("keydown", esc);
      if (opened && previous?.isConnected) previous.focus();
    };
  }, [panel, selected, editing]);
  useEffect(() => {
    if (page === "admin" && user?.role === "admin")
      api<Order[]>("/admin/orders")
        .then(setOrders)
        .catch((e) => setError(e.message));
  }, [page, user, adminTab]);
  useEffect(() => {
    if (panel === "account" && user)
      api<Order[]>("/orders")
        .then(setOrders)
        .catch((e) => setError(e.message));
  }, [panel, user]);
  function navigate(cat = "All gear") {
    setCategory(cat);
    setQuery("");
    location.hash = "shop";
    setPage("shop");
    setMobile(false);
    window.scrollTo(0, 0);
  }
  function openProduct(p: Product) {
    setSelected(p);
    setSize("");
    setColor(p.colors[0]);
    setError("");
  }
  function add() {
    if (!selected || !size) {
      setError("Choose your size first.");
      return;
    }
    if (selected.stock === 0) return;
    const existing = bag.find(
      (l) => l.id === selected.id && l.size === size && l.color === color,
    );
    if ((existing?.quantity || 0) >= 10) {
      setError("Maximum 10 per variant.");
      return;
    }
    if (
      bag
        .filter((l) => l.id === selected.id)
        .reduce((s, l) => s + l.quantity, 0) >= selected.stock
    ) {
      setError("You have all available stock in your bag.");
      return;
    }
    setBag((b) =>
      existing
        ? b.map((l) =>
            l === existing ? { ...l, quantity: l.quantity + 1 } : l,
          )
        : [...b, { id: selected.id, size, color, quantity: 1 }],
    );
    setSelected(null);
    setNotice("Added to your bag. Good choice.");
  }
  const lines = bag.map((l) => ({
      ...l,
      product: products.find((p) => p.id === l.id),
    })),
    subtotal = lines.reduce(
      (s, l) => s + (l.product?.price || 0) * l.quantity,
      0,
    ),
    shipping = subtotal >= 150 || subtotal === 0 ? 0 : 8,
    count = bag.reduce((s, l) => s + l.quantity, 0);
  const filtered = products
    .filter(
      (p) =>
        (category === "All gear" || p.category === category) &&
        `${p.name} ${p.category} ${p.description}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (sizeFilter === "All sizes" || p.sizes.includes(sizeFilter)) &&
        p.price <= maxPrice,
    )
    .sort((a, b) =>
      sort === "Price: low to high"
        ? a.price - b.price
        : sort === "Price: high to low"
          ? b.price - a.price
          : sort === "Newest"
            ? b.id - a.id
            : 0,
    );
  async function authenticate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    try {
      setUser(await api<User>("/auth/" + authMode, fields));
      setPanel("");
      setNotice("You’re in. Welcome to PACE.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function checkout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fields = Object.fromEntries(new FormData(e.currentTarget));
      setOrder(await api("/orders", { ...fields, items: bag }));
      setBag([]);
      await refresh();
      setPanel("success");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    await api("/auth/logout", {});
    setUser(null);
    setPanel("");
    location.hash = "home";
    setNotice("Signed out. See you next session.");
  }
  async function saveProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api(
        "/admin/products" + (editing?.id ? "/" + editing.id : ""),
        {
          ...f,
          price: Number(f.price),
          stock: Number(f.stock),
          sizes: String(f.sizes)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          colors: String(f.colors)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
        editing?.id ? "PUT" : "POST",
      );
      await refresh();
      setEditing(null);
      setNotice("Product saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function productCard(p: Product) {
    return (
      <article className="product-card" key={p.id}>
        <div className={"product-image tone-" + p.id}>
          <button
            className="image-button"
            onClick={() => openProduct(p)}
            aria-label={"View " + p.name}
          >
            <img src={p.image} alt={p.name} loading="lazy" />
          </button>
          {p.badge && <span className="badge">{p.badge}</span>}
          <button
            className={"favorite " + (wish.includes(p.id) ? "active" : "")}
            aria-label={(wish.includes(p.id) ? "Unsave " : "Save ") + p.name}
            onClick={() =>
              setWish((w) =>
                w.includes(p.id) ? w.filter((id) => id !== p.id) : [...w, p.id],
              )
            }
          >
            <Heart
              size={17}
              fill={wish.includes(p.id) ? "currentColor" : "none"}
            />
          </button>
          <button className="quick-add" onClick={() => openProduct(p)}>
            {p.stock ? "Choose your size" : "View product"}
            <Plus size={18} />
          </button>
        </div>
        <div className="product-meta">
          <div>
            <p>{p.category} / Unisex</p>
            <button onClick={() => openProduct(p)}>{p.name}</button>
          </div>
          <span>{money(p.price)}</span>
        </div>
        <div className="swatches">
          {p.colors.map((c) => (
            <span
              key={c}
              style={{
                background:
                  c === "Black"
                    ? "#222"
                    : c === "Chalk"
                      ? "#dedbd1"
                      : c === "Sage"
                        ? "#8b967c"
                        : "#686e49",
              }}
              title={c}
            />
          ))}
          <small>{p.stock ? `${p.colors.length} colors` : "Sold out"}</small>
        </div>
      </article>
    );
  }
  return (
    <>
      <div className="announcement">
        YOUR NEXT CHAPTER STARTS IN MOTION{" "}
        <span>
          Free shipping on orders $150+ <ArrowUpRight size={12} />
        </span>
      </div>
      <header>
        <a className="logo" href="#home" aria-label="PACE home">
          PACE<span>®</span>
        </a>
        <nav className={mobile ? "open" : ""}>
          <button onClick={() => navigate()}>Shop all</button>
          <button onClick={() => navigate("Footwear")}>Footwear</button>
          <button onClick={() => navigate("Tops")}>Clothing</button>
          <button onClick={() => navigate("Accessories")}>Accessories</button>
          <a
            href="#home"
            onClick={() =>
              setTimeout(
                () =>
                  document
                    .getElementById("story")
                    ?.scrollIntoView({ behavior: "smooth" }),
                50,
              )
            }
          >
            Our mindset <ArrowUpRight size={12} />
          </a>
        </nav>
        <div className="header-actions">
          <button
            aria-label="Search products"
            onClick={() => {
              navigate();
              setTimeout(
                () => document.getElementById("product-search")?.focus(),
                80,
              );
            }}
          >
            <Search size={21} />
          </button>
          <button
            aria-label="Your account"
            onClick={() => {
              setError("");
              setPanel(user ? "account" : "auth");
            }}
          >
            <UserRound size={21} />
          </button>
          <button
            className="bag-button"
            aria-label={"Open bag, " + count + " items"}
            onClick={() => {
              setError("");
              setPanel("bag");
            }}
          >
            <ShoppingBag size={20} />
            <span>{count}</span>
          </button>
          <button
            className="mobile-toggle"
            aria-label="Toggle navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
        </div>
      </header>
      {error && !panel && !selected && !editing && (
        <div className="global-error">
          {error}
          <button
            onClick={() => {
              setError("");
              refresh().catch((e) => setError(e.message));
            }}
          >
            Retry
          </button>
        </div>
      )}
      {page === "home" && (
        <main>
          <section className="hero">
            <img
              className="hero-photo"
              src="/images/hero.jpg"
              alt="Athletes running together on a sunlit outdoor track"
            />
            <div className="hero-shade" />
            <div className="hero-top">
              <span>THE EVERYDAY ATHLETE COLLECTION</span>
              <span>EST. 2026 / BUILT TO MOVE</span>
            </div>
            <div className="hero-content">
              <div className="eyebrow">
                <span className="dot" /> MAKE YOUR MOVE
              </div>
              <h1>
                Find your
                <br />
                next <em>gear.</em>
              </h1>
              <p>
                For the early starts. The extra rep. The everyday you.
                <br />
                Performance essentials that keep up.
              </p>
              <button className="button lime" onClick={() => navigate()}>
                Explore the collection <ArrowUpRight size={20} />
              </button>
            </div>
            <div className="hero-bottom">
              <span>NO FINISH LINE. JUST YOUR NEXT STEP.</span>
              <a href="#bestsellers">
                SCROLL TO DISCOVER <ChevronDown size={15} />
              </a>
            </div>
            <div className="hero-coordinate">01 — EVERYDAY EXTRAORDINARY</div>
          </section>
          <div className="ticker">
            <span>BUILT FOR YOUR PACE</span>
            <span>✳</span>
            <span>MOVE WITH PURPOSE</span>
            <span>✳</span>
            <span>EVERY DAY. EVERY BODY.</span>
            <span>✳</span>
            <span>BUILT FOR YOUR PACE</span>
            <span>✳</span>
          </div>
          <section className="section category-section">
            <div className="section-heading">
              <div>
                <div className="eyebrow">01 / FIND YOUR ELEMENT</div>
                <h2>
                  Different moves.
                  <br />
                  Same mindset.
                </h2>
              </div>
              <p>
                Whatever gets you going,
                <br />
                we’ve got your next move covered.
              </p>
            </div>
            <div className="category-grid">
              {[
                {
                  title: "The running edit",
                  tag: "CHASE YOUR OWN HORIZON",
                  cat: "Footwear",
                  img: "running",
                },
                {
                  title: "Made for the work",
                  tag: "SHOW UP. GO AGAIN.",
                  cat: "Tops",
                  img: "training",
                },
                {
                  title: "Off the clock",
                  tag: "RECOVERY IS PART OF THE PLAN",
                  cat: "Accessories",
                  img: "lifestyle",
                },
              ].map((c) => (
                <button
                  className="category-tile"
                  key={c.title}
                  onClick={() => navigate(c.cat)}
                >
                  <img
                    src={`/images/${c.img}.jpg`}
                    alt={c.title}
                    loading="lazy"
                  />
                  <div>
                    <small>{c.tag}</small>
                    <h3>{c.title}</h3>
                  </div>
                  <span className="circle">
                    <ArrowUpRight size={23} />
                  </span>
                </button>
              ))}
            </div>
          </section>
          <section className="section bestsellers" id="bestsellers">
            <div className="section-heading">
              <div>
                <div className="eyebrow">02 / IN GOOD COMPANY</div>
                <h2>Your next favorites.</h2>
              </div>
              <button className="text-link" onClick={() => navigate()}>
                Shop all gear <ArrowUpRight size={18} />
              </button>
            </div>
            <div className="product-grid">
              {loading ? (
                <p>Getting your gear ready…</p>
              ) : (
                products.slice(0, 4).map(productCard)
              )}
            </div>
          </section>
          <section className="manifesto" id="story">
            <div className="manifesto-photo">
              <img
                src="/images/story.jpg"
                alt="Runner finding their own pace on an open road"
                loading="lazy"
              />
              <span>PACE IS PERSONAL.</span>
            </div>
            <div className="manifesto-copy">
              <div className="eyebrow">MORE THAN WHAT YOU WEAR.</div>
              <h2>
                You don’t need
                <br />
                to be the best.
                <br />
                <em>Just begin.</em>
              </h2>
              <p>
                We believe movement belongs to everyone. The first-timers. The
                lifelong runners. The people finding their way back.
              </p>
              <p>
                That’s why we make considered essentials that feel good, work
                hard, and go wherever your day takes you.
              </p>
              <button className="button lime" onClick={() => navigate()}>
                Find your PACE <ArrowUpRight size={20} />
              </button>
              <small>GO AT YOUR OWN SPEED. JUST KEEP GOING.</small>
            </div>
          </section>
          <section className="benefits">
            <div>
              <Truck />
              <h4>A little further, on us.</h4>
              <p>Free shipping on orders $150+</p>
            </div>
            <div>
              <RefreshCw />
              <h4>Find your perfect fit.</h4>
              <p>Demo store · no real purchases</p>
            </div>
            <div>
              <ShieldCheck />
              <h4>Made for the long run.</h4>
              <p>Thoughtful essentials. Everyday purpose.</p>
            </div>
          </section>
        </main>
      )}
      {page === "shop" && (
        <main className="shop section">
          <div className="breadcrumbs">
            <a href="#home">Home</a> / The collection
          </div>
          <div className="shop-heading">
            <div className="eyebrow">THE PACE COLLECTION / 2026</div>
            <h1>
              Gear up.
              <br />
              <em>Get out there.</em>
            </h1>
            <p>Everyday performance. Exceptional feeling.</p>
          </div>
          <div className="catalog-toolbar">
            <div className="category-tabs">
              {categories.map((c) => (
                <button
                  className={category === c ? "active" : ""}
                  key={c}
                  onClick={() => setCategory(c)}
                >
                  {c}
                  {c === "All gear" && <sup>{products.length}</sup>}
                </button>
              ))}
            </div>
            <button
              className="filter-toggle"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal size={16} /> Filters
            </button>
          </div>
          <div className="search-row">
            <label className="search-field">
              <Search size={18} />
              <input
                id="product-search"
                aria-label="Search products"
                placeholder="Find your next essential…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button aria-label="Clear search" onClick={() => setQuery("")}>
                  <X size={16} />
                </button>
              )}
            </label>
            <label className="sort-label">
              Sort by{" "}
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                {[
                  "Featured",
                  "Newest",
                  "Price: low to high",
                  "Price: high to low",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          {showFilters && (
            <div className="filters">
              <label>
                Size
                <select
                  value={sizeFilter}
                  onChange={(e) => setSizeFilter(e.target.value)}
                >
                  {[
                    "All sizes",
                    ...new Set(products.flatMap((p) => p.sizes)),
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Maximum price: {money(maxPrice)}
                <input
                  type="range"
                  min="15"
                  max="200"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                />
              </label>
              <button
                className="text-link"
                onClick={() => {
                  setSizeFilter("All sizes");
                  setMaxPrice(200);
                  setQuery("");
                  setCategory("All gear");
                }}
              >
                Reset filters <X size={15} />
              </button>
            </div>
          )}
          <p className="result-count">
            {filtered.length} essentials for your next move
          </p>
          <div className="product-grid catalog">
            {filtered.map(productCard)}
          </div>
          {!filtered.length && !loading && (
            <div className="empty">
              <Search size={32} />
              <h3>No gear found.</h3>
              <p>Try another search or reset your filters.</p>
            </div>
          )}
        </main>
      )}
      {page === "admin" && (
        <main className="section admin">
          {user?.role !== "admin" ? (
            <div className="empty">
              <ShieldCheck size={40} />
              <h1>The PACE studio.</h1>
              <p>
                Sign in with an admin account to manage products and orders.
              </p>
              <button
                className="button dark"
                onClick={() => {
                  setError("");
                  setPanel("auth");
                }}
              >
                Admin sign in <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <>
              <div className="section-heading">
                <div>
                  <div className="eyebrow">PACE / BACK OFFICE</div>
                  <h1>The studio.</h1>
                  <p>Good gear. Great operations.</p>
                </div>
                <button
                  className="button dark"
                  onClick={() => {
                    setError("");
                    setEditing({
                      id: 0,
                      name: "",
                      category: "Tops",
                      price: 48,
                      description: "",
                      sizes: ["S", "M", "L"],
                      colors: ["Black"],
                      image: "",
                      badge: "NEW",
                      stock: 20,
                    });
                  }}
                >
                  <Plus size={17} /> Add product
                </button>
              </div>
              <div className="admin-tabs">
                {["overview", "products", "orders"].map((t) => (
                  <button
                    key={t}
                    className={adminTab === t ? "active" : ""}
                    onClick={() => setAdminTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {adminTab === "overview" && (
                <>
                  <div className="stats">
                    <div>
                      <span>Demo revenue</span>
                      <strong>
                        {money(orders.reduce((s, o) => s + o.total, 0) / 100)}
                      </strong>
                      <small>All orders · no real payments</small>
                    </div>
                    <div>
                      <span>Orders</span>
                      <strong>{orders.length}</strong>
                      <small>
                        {orders.filter((o) => o.status === "Processing").length}{" "}
                        awaiting fulfillment
                      </small>
                    </div>
                    <div>
                      <span>Active products</span>
                      <strong>{products.length}</strong>
                      <small>
                        {products.reduce((s, p) => s + p.stock, 0)} units in
                        stock
                      </small>
                    </div>
                  </div>
                  <h2>Latest orders</h2>
                </>
              )}
              {adminTab === "products" ? (
                <div className="admin-products">
                  {products.map((p) => (
                    <div key={p.id}>
                      <img src={p.image} alt="" />
                      <div>
                        <h3>{p.name}</h3>
                        <p>
                          {p.category} · {money(p.price)}
                        </p>
                      </div>
                      <span>{p.stock} in stock</span>
                      <button
                        className="text-link"
                        onClick={() => {
                          setError("");
                          setEditing(p);
                        }}
                      >
                        Edit <ArrowUpRight size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="orders-table">
                  {!orders.length ? (
                    <div className="empty">
                      <Package size={30} />
                      <h3>Your first order starts here.</h3>
                      <p>
                        Place a demo checkout to see it appear in the studio.
                      </p>
                    </div>
                  ) : (
                    orders
                      .slice(0, adminTab === "overview" ? 5 : undefined)
                      .map((o) => (
                        <div className="order-row" key={o.id}>
                          <div>
                            <strong>{o.id}</strong>
                            <p>
                              {o.name} ·{" "}
                              {new Date(o.created).toLocaleDateString()}
                            </p>
                            <small>
                              {o.items
                                .map(
                                  (l) =>
                                    `${l.quantity}× ${l.name} (${l.size}, ${l.color})`,
                                )
                                .join(" · ")}
                            </small>
                            <p>{o.address}</p>
                          </div>
                          <strong>{money(o.total / 100)}</strong>
                          <select
                            aria-label={"Status for " + o.id}
                            value={o.status}
                            onChange={async (e) => {
                              try {
                                await api(
                                  "/admin/orders/" + o.id,
                                  { status: e.target.value },
                                  "PATCH",
                                );
                                setOrders(await api("/admin/orders"));
                                setNotice("Order updated.");
                              } catch (e) {
                                setError((e as Error).message);
                              }
                            }}
                          >
                            {["Processing", "Shipped", "Delivered"].map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      ))
                  )}
                </div>
              )}
            </>
          )}
        </main>
      )}
      <footer>
        <div className="footer-top">
          <div>
            <div className="eyebrow">THE NEXT MOVE IS YOURS.</div>
            <h2>See you out there.</h2>
            <button className="text-link" onClick={() => navigate()}>
              Discover your everyday essentials <ArrowUpRight size={20} />
            </button>
          </div>
          <div className="footer-links">
            <div>
              <h4>THE GEAR</h4>
              {categories.map((c) => (
                <button key={c} onClick={() => navigate(c)}>
                  {c}
                </button>
              ))}
            </div>
            <div>
              <h4>THE DETAILS</h4>
              <button
                onClick={() => {
                  setError("");
                  setPanel("help");
                }}
              >
                Shipping & returns
              </button>
              <button
                onClick={() => {
                  setError("");
                  setPanel("sizes");
                }}
              >
                Size guide
              </button>
              <button
                onClick={() => {
                  setError("");
                  setPanel(user ? "account" : "auth");
                }}
              >
                My account
              </button>
              <a href="#admin">
                PACE studio <ArrowUpRight size={12} />
              </a>
            </div>
          </div>
        </div>
        <div className="footer-wordmark">
          PACE<span>®</span>
          <ArrowUpRight />
        </div>
        <div className="footer-bottom">
          <span>© 2026 PACE. A portfolio concept store.</span>
          <span>DEMO CHECKOUT · NO REAL PAYMENTS</span>
          <span>GO AT YOUR OWN PACE.</span>
        </div>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      {(panel || selected || editing) && (
        <div
          className="overlay"
          onClick={() => {
            setPanel("");
            setSelected(null);
            setEditing(null);
            setError("");
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={selected?.name || (editing ? "Product editor" : panel)}
            className={
              "modal " +
              (panel === "bag" ? "drawer" : "") +
              (selected ? " product-modal" : "")
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label="Close dialog"
              autoFocus
              onClick={() => {
                setPanel("");
                setSelected(null);
                setEditing(null);
                setError("");
              }}
            >
              <X />
            </button>
            {selected && (
              <>
                <div className="detail-image">
                  <img src={selected.image} alt={selected.name} />
                </div>
                <div className="detail-copy">
                  <div className="eyebrow">
                    PACE / {selected.category.toUpperCase()}
                  </div>
                  <h2>{selected.name}</h2>
                  <div className="detail-price">
                    {money(selected.price)}
                    <span>
                      {selected.stock
                        ? "In stock · ready to move"
                        : "Currently sold out"}
                    </span>
                  </div>
                  <p>{selected.description}</p>
                  <label>COLOR — {color.toUpperCase()}</label>
                  <div className="options">
                    {selected.colors.map((c) => (
                      <button
                        key={c}
                        className={color === c ? "chosen" : ""}
                        onClick={() => setColor(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <div className="size-heading">
                    <label>SELECT SIZE</label>
                    <button
                      onClick={() => {
                        setSelected(null);
                        setPanel("sizes");
                      }}
                    >
                      Size guide <ArrowUpRight size={13} />
                    </button>
                  </div>
                  <div className="options sizes">
                    {selected.sizes.map((s) => (
                      <button
                        key={s}
                        className={size === s ? "chosen" : ""}
                        onClick={() => {
                          setSize(s);
                          setError("");
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <button
                    className="button dark full"
                    disabled={!selected.stock}
                    onClick={add}
                  >
                    {selected.stock
                      ? "Add to bag — " + money(selected.price)
                      : "Sold out"}
                    <Plus size={18} />
                  </button>
                  <small className="detail-note">
                    <Truck size={16} /> Free shipping $150+ · Demo checkout
                  </small>
                  <details>
                    <summary>Designed for everyday movement</summary>
                    <p>
                      Choose your regular size for a comfortable fit. Check the
                      size guide before ordering. This is a portfolio concept;
                      material specifications are illustrative.
                    </p>
                  </details>
                </div>
              </>
            )}
            {panel === "bag" && (
              <>
                <div className="eyebrow">YOUR NEXT MOVE</div>
                <h2>
                  The bag. <sup>({count})</sup>
                </h2>
                {!bag.length ? (
                  <div className="empty">
                    <ShoppingBag size={38} />
                    <h3>Room for something good.</h3>
                    <p>Your everyday essentials are waiting.</p>
                    <button
                      className="button dark"
                      onClick={() => {
                        setPanel("");
                        navigate();
                      }}
                    >
                      Explore the collection <ArrowUpRight size={18} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="shipping-progress">
                      <p>
                        {subtotal >= 150
                          ? "You’ve unlocked free shipping."
                          : `${money(150 - subtotal)} away from free shipping.`}
                      </p>
                      <div>
                        <span
                          style={{
                            width: Math.min(100, (subtotal / 150) * 100) + "%",
                          }}
                        />
                      </div>
                    </div>
                    <div className="bag-items">
                      {lines.map((l, i) => (
                        <div
                          className="bag-item"
                          key={`${l.id}-${l.size}-${l.color}`}
                        >
                          <img
                            src={l.product?.image}
                            alt={l.product?.name || "Unavailable product"}
                          />
                          <div>
                            <h4>{l.product?.name || "Unavailable product"}</h4>
                            <p>
                              {l.color} / {l.size}
                            </p>
                            <strong>
                              {money((l.product?.price || 0) * l.quantity)}
                            </strong>
                            <div className="quantity">
                              <button
                                aria-label="Decrease quantity"
                                onClick={() =>
                                  setBag((b) =>
                                    b.flatMap((x, j) =>
                                      j === i
                                        ? x.quantity > 1
                                          ? [{ ...x, quantity: x.quantity - 1 }]
                                          : []
                                        : [x],
                                    ),
                                  )
                                }
                              >
                                <Minus size={13} />
                              </button>
                              <span>{l.quantity}</span>
                              <button
                                aria-label="Increase quantity"
                                disabled={
                                  l.quantity >= 10 ||
                                  bag
                                    .filter((x) => x.id === l.id)
                                    .reduce((s, x) => s + x.quantity, 0) >=
                                    (l.product?.stock || 0)
                                }
                                onClick={() =>
                                  setBag((b) =>
                                    b.map((x, j) =>
                                      j === i
                                        ? { ...x, quantity: x.quantity + 1 }
                                        : x,
                                    ),
                                  )
                                }
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                          </div>
                          <button
                            className="remove"
                            aria-label={"Remove " + l.product?.name}
                            onClick={() =>
                              setBag((b) => b.filter((_, j) => j !== i))
                            }
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="totals">
                      <p>
                        <span>Subtotal</span>
                        <span>{money(subtotal)}</span>
                      </p>
                      <p>
                        <span>Shipping</span>
                        <span>{shipping ? money(shipping) : "On us"}</span>
                      </p>
                      <p className="total">
                        <span>Total</span>
                        <span>{money(subtotal + shipping)}</span>
                      </p>
                    </div>
                    <button
                      className="button dark full"
                      onClick={() => {
                        setError("");
                        setPanel("checkout");
                      }}
                    >
                      Demo checkout <ArrowRight size={18} />
                    </button>
                    <p className="fine-print">
                      No card required. No real payment collected.
                    </p>
                  </>
                )}
              </>
            )}
            {panel === "checkout" && (
              <>
                <div className="eyebrow">ONE LAST STEP</div>
                <h2>Good things ahead.</h2>
                <p className="muted">
                  Demo order · no real payment. Use sample delivery details.
                </p>
                <form onSubmit={checkout}>
                  <label>
                    Full name
                    <input
                      name="name"
                      required
                      maxLength={80}
                      defaultValue={user?.name}
                      placeholder="Alex Morgan"
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    Email address
                    <input
                      name="email"
                      type="email"
                      required
                      maxLength={254}
                      defaultValue={user?.email}
                      placeholder="alex@example.com"
                      autoComplete="email"
                    />
                  </label>
                  <label>
                    Delivery address
                    <textarea
                      name="address"
                      required
                      maxLength={500}
                      placeholder="Street, city, postal code, country"
                      autoComplete="street-address"
                    />
                  </label>
                  <div className="checkout-summary">
                    {lines.map((l, i) => (
                      <p key={i}>
                        <span>
                          {l.quantity} × {l.product?.name} · {l.size}
                        </span>
                        <b>{money((l.product?.price || 0) * l.quantity)}</b>
                      </p>
                    ))}
                    <p>
                      <span>Shipping</span>
                      <b>{shipping ? money(shipping) : "Free"}</b>
                    </p>
                    <p className="total">
                      <span>Total</span>
                      <b>{money(subtotal + shipping)}</b>
                    </p>
                  </div>
                  <button
                    className="button dark full"
                    disabled={busy || !bag.length}
                  >
                    {busy ? "Placing order…" : "Place demo order"}
                    <ArrowRight size={18} />
                  </button>
                </form>
                <p className="fine-print">
                  Prices in USD. This portfolio demo collects no payment.
                </p>
              </>
            )}
            {panel === "success" && (
              <div className="success">
                <div className="success-icon">
                  <Check size={34} />
                </div>
                <div className="eyebrow">YOU’RE ALL SET.</div>
                <h2>
                  Your next move
                  <br />
                  is on its way.
                </h2>
                <p>
                  Demo order <strong>{order?.id}</strong> is confirmed.
                </p>
                <p>
                  {money((order?.total || 0) / 100)} · No payment collected.
                </p>
                <p className="muted">
                  {user
                    ? "Find it in your account, or view it in the admin studio."
                    : "Save this reference. Guest orders can be managed in the admin studio."}{" "}
                  No email is sent by this demo.
                </p>
                <button
                  className="button dark full"
                  onClick={() => {
                    setPanel("");
                    navigate();
                  }}
                >
                  Keep exploring <ArrowUpRight size={18} />
                </button>
              </div>
            )}
            {panel === "auth" && (
              <>
                <div className="eyebrow">YOUR PACE. YOUR SPACE.</div>
                <h2>
                  {authMode === "login"
                    ? "Welcome back."
                    : "Join the movement."}
                </h2>
                <p className="muted">Save your orders. Find your rhythm.</p>
                <form onSubmit={authenticate}>
                  {authMode === "register" && (
                    <label>
                      Name
                      <input
                        name="name"
                        required
                        maxLength={80}
                        autoComplete="name"
                      />
                    </label>
                  )}
                  <label>
                    Email
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                    />
                  </label>
                  <label>
                    Password
                    <input
                      name="password"
                      type="password"
                      required
                      minLength={authMode === "register" ? 10 : 1}
                      maxLength={128}
                      autoComplete={
                        authMode === "login"
                          ? "current-password"
                          : "new-password"
                      }
                    />
                  </label>
                  {authMode === "register" && (
                    <small>Use 10 or more characters.</small>
                  )}
                  <button className="button dark full" disabled={busy}>
                    {busy
                      ? "One moment…"
                      : authMode === "login"
                        ? "Sign in"
                        : "Create account"}
                    <ArrowRight size={18} />
                  </button>
                </form>
                <button
                  className="auth-switch"
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "register" : "login");
                    setError("");
                  }}
                >
                  {authMode === "login"
                    ? "New here? Create an account"
                    : "Already moving with us? Sign in"}
                </button>
              </>
            )}
            {panel === "account" && user && (
              <>
                <div className="eyebrow">YOUR PACE</div>
                <h2>Hey, {user.name.split(" ")[0]}.</h2>
                <p className="muted">{user.email}</p>
                {user.role === "admin" && (
                  <button
                    className="button dark full"
                    onClick={() => {
                      setPanel("");
                      location.hash = "admin";
                    }}
                  >
                    <LayoutDashboard size={18} /> Open PACE studio
                  </button>
                )}
                <h3>Your orders</h3>
                {!orders.length ? (
                  <p className="muted">
                    Your next chapter starts with your first order.
                  </p>
                ) : (
                  orders.map((o) => (
                    <div className="account-order" key={o.id}>
                      <div>
                        <strong>{o.id}</strong>
                        <p>
                          {new Date(o.created).toLocaleDateString()} ·{" "}
                          {o.items.length} items
                        </p>
                      </div>
                      <div>
                        <strong>{money(o.total / 100)}</strong>
                        <p className="status-pill">{o.status}</p>
                      </div>
                    </div>
                  ))
                )}
                <h3>Saved gear</h3>
                {!wish.length ? (
                  <p className="muted">
                    Tap a heart on a product to save it here.
                  </p>
                ) : (
                  <div className="saved-list">
                    {products
                      .filter((p) => wish.includes(p.id))
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setPanel("");
                            openProduct(p);
                          }}
                        >
                          <img src={p.image} alt="" />
                          {p.name}
                          <ArrowUpRight size={15} />
                        </button>
                      ))}
                  </div>
                )}
                <button
                  className="text-link logout"
                  onClick={() => logout().catch((e) => setError(e.message))}
                >
                  <LogOut size={16} /> Sign out
                </button>
              </>
            )}
            {panel === "sizes" && (
              <>
                <div className="eyebrow">FIND YOUR FIT</div>
                <h2>A little guidance.</h2>
                <p>
                  Illustrative unisex measurements for this concept collection.
                  Measure around the fullest part of your chest and your natural
                  waist.
                </p>
                <table>
                  <thead>
                    <tr>
                      <th>Size</th>
                      <th>Chest (cm)</th>
                      <th>Waist (cm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["XS", "81–86", "66–71"],
                      ["S", "87–94", "72–79"],
                      ["M", "95–102", "80–87"],
                      ["L", "103–110", "88–95"],
                      ["XL", "111–118", "96–103"],
                    ].map((r) => (
                      <tr key={r[0]}>
                        {r.map((c) => (
                          <td key={c}>{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="muted">
                  Footwear is listed in US sizes. Between sizes? Size up for a
                  more relaxed fit. Accessories with “One size” have no size
                  selection requirement beyond that option.
                </p>
              </>
            )}
            {panel === "help" && (
              <>
                <div className="eyebrow">THE DETAILS</div>
                <h2>Good to know.</h2>
                <h3>Shipping</h3>
                <p>
                  Demo shipping is $8, or free on orders of $150 or more. All
                  prices are in USD.
                </p>
                <h3>A portfolio concept</h3>
                <p>
                  PACE is a working e-commerce demonstration. Orders are stored
                  in the database and appear in the admin studio, but nothing is
                  charged, shipped or emailed.
                </p>
                <h3>Returns</h3>
                <p>
                  There are no real purchases to return. Please use sample
                  delivery details when exploring checkout.
                </p>
              </>
            )}
            {editing && (
              <>
                <div className="eyebrow">PACE / PRODUCT STUDIO</div>
                <h2>{editing.id ? "Edit essential." : "Something new."}</h2>
                <form onSubmit={saveProduct}>
                  <label>
                    Product name
                    <input
                      name="name"
                      required
                      maxLength={100}
                      defaultValue={editing.name}
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      Category
                      <select name="category" defaultValue={editing.category}>
                        {categories.slice(1).map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Price (USD)
                      <input
                        name="price"
                        type="number"
                        min="1"
                        max="10000"
                        step="0.01"
                        required
                        defaultValue={editing.price}
                      />
                    </label>
                  </div>
                  <label>
                    Description
                    <textarea
                      name="description"
                      required
                      maxLength={1500}
                      defaultValue={editing.description}
                    />
                  </label>
                  <label>
                    Image URL (HTTPS or /images/…)
                    <input
                      name="image"
                      type="text"
                      pattern="(https://.*|/images/.*)"
                      required
                      defaultValue={editing.image}
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      Sizes, comma separated
                      <input
                        name="sizes"
                        required
                        defaultValue={editing.sizes.join(", ")}
                      />
                    </label>
                    <label>
                      Colors, comma separated
                      <input
                        name="colors"
                        required
                        defaultValue={editing.colors.join(", ")}
                      />
                    </label>
                  </div>
                  <div className="form-row">
                    <label>
                      Stock
                      <input
                        name="stock"
                        type="number"
                        min="0"
                        max="100000"
                        required
                        defaultValue={editing.stock}
                      />
                    </label>
                    <label>
                      Badge
                      <input
                        name="badge"
                        maxLength={30}
                        defaultValue={editing.badge}
                      />
                    </label>
                  </div>
                  <button className="button dark full" disabled={busy}>
                    {busy ? "Saving…" : "Save product"}
                    <Check size={18} />
                  </button>
                </form>
              </>
            )}
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
