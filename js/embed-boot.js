const script = document.currentScript;
const base = new URL("./", (script && script.src) || "https://mkpworks.github.io/live-concert-finder/embed.js");
let catalogPromise = null;

function cssHeight(value) {
  const text = String(value == null ? "" : value).trim();
  if (!text) return "";
  if (/^\d+(\.\d+)?$/.test(text)) return text + "px";
  return text;
}

function accentInk(hex) {
  let body = String(hex || "").replace("#", "");
  if (body.length === 3) body = body.split("").map((ch) => ch + ch).join("");
  if (body.length < 6) return "#1c1406";
  const r = parseInt(body.slice(0, 2), 16);
  const g = parseInt(body.slice(2, 4), 16);
  const b = parseInt(body.slice(4, 6), 16);
  if ([r, g, b].some((part) => Number.isNaN(part))) return "#1c1406";
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? "#1c1406" : "#fff8ea";
}

function readOptions(el, extra) {
  const fromEl = el ? {
    theme: el.getAttribute("data-theme"),
    accent: el.getAttribute("data-accent"),
    type: el.getAttribute("data-type"),
    artist: el.getAttribute("data-artist"),
    height: el.getAttribute("data-height"),
  } : {};
  const options = Object.assign({}, fromEl, extra || {});
  return options;
}

function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = (async function () {
      const versionUrl = new URL("data/version.json", base);
      versionUrl.searchParams.set("t", String(Date.now()));
      const versionRes = await fetch(versionUrl.href, { cache: "no-store" });
      if (!versionRes.ok) throw new Error("version");
      const version = await versionRes.json();
      const catalogUrl = new URL("data/catalog.json", base);
      catalogUrl.searchParams.set("v", version.generated_at || version.version || "1");
      const catalogRes = await fetch(catalogUrl.href);
      if (!catalogRes.ok) throw new Error("catalog");
      const catalog = await catalogRes.json();
      if (!catalog || catalog.version !== "1" || !Array.isArray(catalog.concerts) || !catalog.musicians) {
        throw new Error("catalog shape");
      }
      return catalog;
    })().catch((error) => {
      catalogPromise = null;
      throw error;
    });
  }
  return catalogPromise;
}

function mount(el, extra) {
  if (!el) return null;
  if (el.__concertFinder) return el.__concertFinder;
  const options = readOptions(el, extra);
  const shadow = el.shadowRoot || el.attachShadow({ mode: "open" });
  const theme = options.theme === "light" || options.theme === "dark"
    ? options.theme
    : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  el.setAttribute("data-theme", theme);
  el.style.display = "block";
  if (options.accent && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(options.accent)) {
    el.style.setProperty("--accent", options.accent);
    el.style.setProperty("--accent-ink", accentInk(options.accent));
  }
  const height = cssHeight(options.height);
  if (height) {
    el.style.maxHeight = height;
    el.style.overflow = "auto";
  }
  const styleUrl = new URL("css/styles.css", base).href;
  const home = new URL("./", base).href;
  const csv = new URL("data/catalog.csv", base).href;
  shadow.innerHTML = '<link rel="stylesheet" href="' + styleUrl + '">' + FinderView.shellHtml({ home: home, csv: csv });
  const api = { element: el };
  el.__concertFinder = api;
  loadCatalog().then((catalog) => {
    FinderView.mount(shadow, {
      concerts: catalog.concerts,
      musicians: catalog.musicians,
      themeTarget: el,
      persistTheme: false,
      type: options.type,
      artist: options.artist,
    });
  }).catch(() => {
    const status = shadow.getElementById("status");
    if (status) status.textContent = "Could not load the Live Concert Finder catalog.";
  });
  return api;
}

function boot() {
  const nodes = [];
  const byId = document.getElementById("concert-finder");
  if (byId) nodes.push(byId);
  document.querySelectorAll("[data-concert-finder]").forEach((el) => {
    if (nodes.indexOf(el) === -1) nodes.push(el);
  });
  nodes.forEach((el) => mount(el));
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

window.ConcertFinder = { mount: mount };
