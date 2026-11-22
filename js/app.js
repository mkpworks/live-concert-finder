"use strict";

(function () {
  const GENRE_COLORS = ["#e07a5f", "#3aa99a", "#e6a23c", "#7ea2e0", "#c46bdc", "#8fbf6a", "#e09ab2", "#d98a4a"];
  const state = {
    mode: "artist",
    sort: "artist",
    genre: "All",
    decade: "All",
    musician: "All",
    instrument: "All",
    type: "All",
    query: "",
    page: 0,
    open: {},
    pickId: "",
    seedMode: true,
  };
  let index = null;
  let crossStamp = "";
  let discoverStamp = "";

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function labelInstrument(name) {
    return name.slice(0, 1).toUpperCase() + name.slice(1);
  }

  function noteLabel(note) {
    if (note === "audio-only") return "Audio only";
    if (note === "partial") return "Partial";
    return note;
  }

  function youtube(id) {
    return "https://www.youtube.com/watch?v=" + encodeURIComponent(id);
  }

  function thumb(id) {
    return "https://i.ytimg.com/vi/" + encodeURIComponent(id) + "/mqdefault.jpg";
  }

  function genreColor(genre) {
    const at = Math.max(0, index.genres.indexOf(genre));
    return GENRE_COLORS[at % GENRE_COLORS.length];
  }

  function groupId(key) {
    return state.mode + ":" + key;
  }

  function currentRows() {
    return Catalog.sortConcerts(
      index.concerts.filter((concert) => Catalog.matches(concert, state, index)),
      state.sort
    );
  }

  function currentGroups(rows) {
    if (state.mode === "list") return [];
    return Catalog.groupConcerts(rows, state.mode, state.sort, {
      index,
      musician: state.musician,
      query: state.query,
    });
  }

  function fillSelect(id, values, labeler) {
    const select = document.getElementById(id);
    const options = ['<option value="All">All</option>'];
    for (const value of values) {
      const label = labeler ? labeler(value) : value;
      options.push('<option value="' + esc(value) + '">' + esc(label) + "</option>");
    }
    select.innerHTML = options.join("");
    select.value = "All";
  }

  function musicianOptionLabel(name) {
    const instruments = index.instrumentsFor(name).map(labelInstrument);
    return instruments.length ? name + " · " + instruments.join(", ") : name;
  }

  function musicianChip(name, withCount, role) {
    const instruments = index.instrumentsFor(name);
    const linked = index.musicianCount[name] > 1;
    const nameClass = linked && state.musician === name ? "chip-btn is-on" : "chip-btn";
    const nameHtml = linked
      ? '<button type="button" class="' + nameClass + '" data-action="musician" data-name="' + esc(name) + '">' + esc(name) + "</button>"
      : '<span class="chip-name">' + esc(name) + "</span>";
    const roleHtml = role ? '<span class="chip-role">' + esc(role) + "</span>" : "";
    const instHtml = instruments.map((instrument) => {
      const on = state.instrument === instrument ? " is-on" : "";
      return '<button type="button" class="inst-btn' + on + '" data-action="instrument" data-name="' + esc(instrument) + '" aria-label="Filter by ' + esc(labelInstrument(instrument)) + '">' + esc(labelInstrument(instrument)) + "</button>";
    }).join("");
    const countHtml = withCount ? '<span class="chip-count">' + index.musicianCount[name] + "</span>" : "";
    return '<span class="chip">' + nameHtml + roleHtml + (instHtml ? '<span class="chip-insts">' + instHtml + "</span>" : "") + countHtml + "</span>";
  }

  function typePhrase(items) {
    const counts = Catalog.countByType(items);
    return Catalog.TYPES.filter((type) => counts[type.id]).map((type) => {
      const count = counts[type.id];
      return count + " " + (count === 1 ? type.label : type.plural).toLowerCase();
    }).join(", ");
  }

  function concertArticle(concert, options) {
    const grouped = Boolean(options && options.grouped);
    const feature = Boolean(options && options.feature);
    const pivot = Boolean(options && options.pivot);
    const shared = options && options.shared;
    const titleTag = feature || !grouped ? "h3" : "h4";
    const yearHtml = concert.year ? "<span>" + concert.year + "</span>" : "";
    const kind = Catalog.typeInfo(Catalog.itemType(concert));
    const typeBadge = '<span class="type-badge is-' + esc(kind.id) + '">' + esc(kind.label) + "</span>";
    const note = concert.notes ? '<span class="badge">' + esc(noteLabel(concert.notes)) + "</span>" : "";
    const bylineBits = [];
    if (concert.outlet) bylineBits.push(concert.outlet);
    if (concert.interviewer) bylineBits.push("Interviewed by " + concert.interviewer);
    const byline = bylineBits.length ? '<p class="byline">' + esc(bylineBits.join(" · ")) + "</p>" : "";
    const people = Catalog.lineup(concert);
    let sharedHtml = "";
    if (Array.isArray(shared)) {
      const text = shared.length ? "Shared: " + shared.join(", ") : "Same genre: " + concert.genre;
      sharedHtml = '<p class="shared">' + esc(text) + "</p>";
    }
    const pivotHtml = pivot
      ? '<button type="button" class="text-btn" data-action="similar" data-id="' + esc(concert.id) + '">Related</button>'
      : "";
    return (
      '<article class="concert' + (feature ? " is-feature" : "") + '">' +
        '<div class="thumb-wrap"><img class="thumb" alt="" width="320" height="180" loading="lazy" decoding="async" src="' + thumb(concert.id) + '" onerror="this.classList.add(\'is-broken\')"></div>' +
        '<div class="concert-body">' +
          '<div class="concert-top">' +
            "<" + titleTag + ' class="concert-title">' + esc(concert.title) + "</" + titleTag + ">" +
            '<a class="watch" href="' + youtube(concert.id) + '" target="_blank" rel="noopener noreferrer">Watch<span class="visually-hidden"> ' + esc(concert.title) + " on YouTube</span></a>" +
          "</div>" +
          '<p class="meta">' +
            "<span>" + esc(concert.artist) + "</span>" +
            yearHtml +
            typeBadge +
            '<span class="genre"><i style="background:' + genreColor(concert.genre) + '"></i>' + esc(concert.genre) + "</span>" +
            '<span class="time">' + esc(Catalog.formatDuration(concert.durationSeconds)) + "</span>" +
            note +
          "</p>" +
          byline +
          '<div class="chips">' + people.map((person) => musicianChip(person.name, false, person.role)).join("") + "</div>" +
          sharedHtml +
          pivotHtml +
        "</div>" +
      "</article>"
    );
  }

  function groupTitle(key) {
    if (state.mode === "instrument") return labelInstrument(key);
    if (state.mode === "musician") {
      const instruments = index.instrumentsFor(key).map(labelInstrument);
      return instruments.length ? key + " · " + instruments.join(", ") : key;
    }
    return key;
  }

  function groupBlock(group) {
    const id = groupId(group.key);
    const open = Boolean(state.open[id]);
    let extra = "";
    if (state.mode === "instrument") {
      const names = new Set();
      for (const concert of group.items) {
        for (const name of concert.musicians) {
          if (index.instrumentsFor(name).includes(group.key)) names.add(name);
        }
      }
      extra = " · " + names.size + " musician" + (names.size === 1 ? "" : "s");
    }
    const meta = typePhrase(group.items) + " · " + Catalog.formatDuration(group.seconds) + " total" + extra;
    const body = open
      ? '<div class="group-body">' + group.items.map((concert) => concertArticle(concert, { grouped: true, pivot: true })).join("") + "</div>"
      : "";
    return (
      '<section class="group' + (open ? " is-open" : "") + '">' +
        "<h3>" +
          '<button type="button" class="group-toggle" data-action="group" data-group="' + esc(id) + '" aria-expanded="' + (open ? "true" : "false") + '">' +
            '<span class="group-main"><span class="chev" aria-hidden="true">▸</span><span class="group-title">' + esc(groupTitle(group.key)) + "</span></span>" +
            '<span class="group-meta">' + esc(meta) + "</span>" +
          "</button>" +
        "</h3>" +
        body +
      "</section>"
    );
  }

  function emptyState(message) {
    return '<div class="empty"><p>' + esc(message) + '</p><button type="button" class="btn" data-action="clear">Clear filters</button></div>';
  }

  function pager(pages) {
    if (pages < 2) return "";
    const prev = state.page === 0 ? " disabled" : "";
    const next = state.page >= pages - 1 ? " disabled" : "";
    return '<nav class="pager" aria-label="Pagination"><button type="button" class="btn" data-action="prev"' + prev + '>Previous</button><button type="button" class="btn" data-action="next"' + next + ">Next</button></nav>";
  }

  function render(scroll) {
    if (!index) return;
    const focusGroup = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute("data-group");
    const rows = currentRows();
    const groups = currentGroups(rows);
    if (state.seedMode && state.mode !== "list" && groups.length) {
      const anyOpen = groups.some((group) => state.open[groupId(group.key)]);
      if (!anyOpen) state.open[groupId(groups[0].key)] = true;
      state.seedMode = false;
    }
    const totalUnits = state.mode === "list" ? rows.length : groups.length;
    const pages = Catalog.pageCount(totalUnits);
    if (state.page > pages - 1) state.page = pages - 1;
    if (state.page < 0) state.page = 0;
    const start = state.page * Catalog.PER_PAGE;
    const pageRows = rows.slice(start, start + Catalog.PER_PAGE);
    const pageGroups = groups.slice(start, start + Catalog.PER_PAGE);

    const unit = state.mode === "musician" ? "musicians" : state.mode === "instrument" ? "instruments" : "groups";
    const selectedType = state.type === "All" ? null : Catalog.typeInfo(state.type);
    const counted = typePhrase(rows) || (selectedType ? "0 " + selectedType.plural.toLowerCase() : "0 items");
    const concertLabel = rows.length === index.concerts.length
      ? counted
      : counted + " of " + index.concerts.length;
    const groupLabel = state.mode === "list" ? "" : " · " + groups.length + " " + unit;
    document.getElementById("status").textContent = "Page " + (state.page + 1) + " of " + pages + " · " + concertLabel + groupLabel;

    let results = "";
    if (state.mode === "list") {
      results = rows.length
        ? pageRows.map((concert) => concertArticle(concert, { pivot: true })).join("") + pager(pages)
        : emptyState("Nothing matches these filters.");
    } else if (!groups.length) {
      results = emptyState(state.mode === "instrument" ? "No instrument credits match these filters." : "Nothing matches these filters.");
    } else {
      results = pageGroups.map(groupBlock).join("") + pager(pages);
    }
    document.getElementById("results").innerHTML = results;

    const nextCross = state.musician + "\0" + state.instrument;
    if (nextCross !== crossStamp) {
      crossStamp = nextCross;
      document.getElementById("cross").innerHTML = index.crossMusicians.map((name) => musicianChip(name, true)).join("");
    }

    if (state.pickId !== discoverStamp) {
      discoverStamp = state.pickId;
      const pick = index.concerts.find((concert) => concert.id === state.pickId) || index.concerts[0];
      const similar = Catalog.related(pick, index.concerts, 5);
      const relatedHtml = similar.length
        ? '<h3 class="subhead">Related</h3>' + similar.map((item) => concertArticle(item.concert, { shared: item.shared })).join("")
        : '<p class="section-note">No related shows yet.</p>';
      document.getElementById("discover-body").innerHTML = concertArticle(pick, { feature: true }) + relatedHtml;
    }

    syncControls(pages);
    if (focusGroup) {
      const again = [...document.querySelectorAll("[data-group]")].find((node) => node.getAttribute("data-group") === focusGroup);
      if (again) again.focus();
    }
    if (scroll) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById("results").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }

  function formatLong(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours >= 24) return hours + "h " + String(minutes).padStart(2, "0") + "m";
    return Catalog.formatDuration(seconds);
  }

  function stat(label, value) {
    return "<div><dt>" + esc(label) + "</dt><dd>" + esc(value) + "</dd></div>";
  }

  function syncControls(pages) {
    const query = document.getElementById("q");
    if (query.value !== state.query) query.value = state.query;
    for (const id of ["genre", "decade", "musician", "instrument", "sort"]) {
      const el = document.getElementById(id);
      if (el.value !== state[id]) el.value = state[id];
    }
    document.querySelectorAll("[data-mode]").forEach((button) => {
      button.setAttribute("aria-pressed", button.getAttribute("data-mode") === state.mode ? "true" : "false");
    });
    document.querySelectorAll("[data-type]").forEach((button) => {
      button.setAttribute("aria-pressed", button.getAttribute("data-type") === state.type ? "true" : "false");
    });
    document.querySelectorAll("[data-group-only]").forEach((button) => {
      button.hidden = state.mode === "list";
    });
    document.getElementById("instrument-note").hidden = state.mode !== "instrument";
    document.querySelectorAll('[data-action="prev"]').forEach((button) => {
      button.disabled = state.page === 0;
    });
    document.querySelectorAll('[data-action="next"]').forEach((button) => {
      button.disabled = state.page >= pages - 1;
    });
    const theme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    const themeButton = document.getElementById("theme");
    themeButton.textContent = theme === "light" ? "Dark theme" : "Light theme";
    themeButton.setAttribute("aria-label", theme === "light" ? "Switch to dark theme" : "Switch to light theme");
  }

  function toggleTheme() {
    const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("lcf-theme", next); } catch (error) {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next === "light" ? "#f4f0e7" : "#12100d");
    render(false);
  }

  function clearFilters() {
    state.genre = "All";
    state.decade = "All";
    state.musician = "All";
    state.instrument = "All";
    state.type = "All";
    state.query = "";
    state.page = 0;
  }

  function onClick(event) {
    const el = event.target.closest("[data-action]");
    if (!el || el.disabled) return;
    const action = el.getAttribute("data-action");
    if (action === "type") {
      state.type = el.getAttribute("data-type");
      state.page = 0;
      render(false);
    } else if (action === "mode") {
      state.mode = el.getAttribute("data-mode");
      state.page = 0;
      state.seedMode = true;
      render(false);
    } else if (action === "group") {
      const id = el.getAttribute("data-group");
      state.open[id] = !state.open[id];
      render(false);
    } else if (action === "prev") {
      state.page -= 1;
      render(true);
    } else if (action === "next") {
      state.page += 1;
      render(true);
    } else if (action === "expand") {
      for (const group of currentGroups(currentRows())) state.open[groupId(group.key)] = true;
      render(false);
    } else if (action === "collapse") {
      state.open = {};
      render(false);
    } else if (action === "clear") {
      clearFilters();
      render(false);
    } else if (action === "musician") {
      state.musician = el.getAttribute("data-name");
      state.genre = "All";
      state.decade = "All";
      state.instrument = "All";
      state.query = "";
      state.page = 0;
      render(false);
    } else if (action === "instrument") {
      state.instrument = el.getAttribute("data-name");
      state.genre = "All";
      state.decade = "All";
      state.musician = "All";
      state.query = "";
      state.page = 0;
      render(false);
    } else if (action === "similar") {
      state.pickId = el.getAttribute("data-id");
      render(false);
      scrollToDiscover();
    } else if (action === "random") {
      const list = index.concerts;
      if (!list.length) return;
      let next = list[Math.floor(Math.random() * list.length)];
      let guard = 0;
      while (list.length > 1 && next.id === state.pickId && guard < 8) {
        next = list[Math.floor(Math.random() * list.length)];
        guard += 1;
      }
      state.pickId = next.id;
      render(false);
      scrollToDiscover();
    } else if (action === "theme") {
      toggleTheme();
    }
  }

  function scrollToDiscover() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("discover").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  function bind() {
    document.body.addEventListener("click", onClick);
    const typeRoot = document.getElementById("types");
    typeRoot.innerHTML = '<button type="button" data-action="type" data-type="All" aria-pressed="true">All</button>' +
      Catalog.TYPES.map((type) => '<button type="button" data-action="type" data-type="' + type.id + '" aria-pressed="false">' + type.plural + "</button>").join("");
    document.getElementById("q").addEventListener("input", (event) => {
      state.query = event.target.value;
      state.page = 0;
      render(false);
    });
    for (const id of ["genre", "decade", "musician", "instrument", "sort"]) {
      document.getElementById(id).addEventListener("change", (event) => {
        state[id] = event.target.value;
        state.page = 0;
        render(false);
      });
    }
    document.addEventListener("keydown", (event) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      event.preventDefault();
      document.getElementById("q").focus();
    });
  }

  async function load() {
    const [concertsRes, musiciansRes] = await Promise.all([
      fetch("data/concerts.json"),
      fetch("data/musicians.json"),
    ]);
    if (!concertsRes.ok || !musiciansRes.ok) throw new Error("fetch failed");
    const concerts = await concertsRes.json();
    const musicians = await musiciansRes.json();
    if (!Array.isArray(concerts)) throw new Error("concerts");
    index = Catalog.buildIndex(concerts, musicians);
    state.pickId = concerts.some((concert) => concert.id === "5XB7iPsCjC4") ? "5XB7iPsCjC4" : concerts[0].id;
    fillSelect("genre", index.genres);
    fillSelect("decade", index.decades);
    fillSelect("musician", index.musicianNames, musicianOptionLabel);
    fillSelect("instrument", index.instruments, labelInstrument);
    const seconds = concerts.reduce((sum, concert) => sum + concert.durationSeconds, 0);
    const typeCounts = Catalog.countByType(concerts);
    const typeStats = Catalog.TYPES.filter((type) => typeCounts[type.id]).map((type) => stat(type.plural, String(typeCounts[type.id]))).join("");
    document.getElementById("stats").innerHTML =
      typeStats +
      stat("Listening time", formatLong(seconds)) +
      stat("Musicians", String(index.musicianNames.length)) +
      stat("Genres", String(index.genres.length));
    document.getElementById("summary").textContent = typePhrase(concerts) + " on YouTube, grouped by artist and linked by the people in them. Running times are the real video lengths.";
    render(false);
  }

  if (typeof Catalog === "undefined") {
    document.getElementById("status").textContent = "The page scripts did not load.";
  } else {
    bind();
    load().catch(() => {
      document.getElementById("status").textContent = "Could not load the concert data. Serve this folder with a local web server so the JSON can be read.";
    });
  }
})();
