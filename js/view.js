"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FinderView = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const GENRE_COLORS = ["#e07a5f", "#3aa99a", "#e6a23c", "#7ea2e0", "#c46bdc", "#8fbf6a", "#e09ab2", "#d98a4a"];

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function typeOption(value) {
    const text = String(value == null ? "" : value).trim().toLowerCase();
    if (text === "concert" || text === "concerts") return "concert";
    if (text === "interview" || text === "interviews") return "interview";
    return "All";
  }

  // Drop a filter only when it would hide a hit for this search.
  function clearedFilters(index, filters, query) {
    const next = {
      genre: (filters && filters.genre) || "All",
      decade: (filters && filters.decade) || "All",
      musician: (filters && filters.musician) || "All",
      instrument: (filters && filters.instrument) || "All",
      type: (filters && filters.type) || "All",
      artist: (filters && filters.artist) || "",
      query: query || "",
    };
    const hits = index.concerts.filter((item) => Catalog.matches(item, { query: next.query }, index));
    if (!hits.length) return next;
    if (next.genre !== "All" && hits.some((item) => item.genre !== next.genre)) next.genre = "All";
    if (next.decade !== "All" && hits.some((item) => Catalog.decadeOf(item.year) !== next.decade)) next.decade = "All";
    if (next.musician !== "All" && hits.some((item) => !Catalog.lineup(item).some((entry) => entry.name === next.musician))) next.musician = "All";
    if (next.instrument !== "All" && hits.some((item) => !(Array.isArray(item.musicians) ? item.musicians : []).some((name) => index.instrumentsFor(name).includes(next.instrument)))) next.instrument = "All";
    if (next.type !== "All" && hits.some((item) => Catalog.itemType(item) !== next.type)) next.type = "All";
    if (next.artist && hits.some((item) => Catalog.artistSlug(item.artist) !== Catalog.artistSlug(next.artist))) next.artist = "";
    return next;
  }

  function shellHtml(options) {
    const home = (options && options.home) || "https://mkpworks.github.io/live-concert-finder/";
    const csv = (options && options.csv) || (home + "data/catalog.csv");
    return (
      '<div class="finder">' +
        '<header class="site-header"><div class="wrap header-row"><div>' +
          '<p class="eyebrow">YouTube archive</p>' +
          "<h1>Live Concert Finder</h1>" +
          '<p class="lede" id="summary">Concerts, interviews, and other long-form sets, grouped by artist and linked by the people in them.</p>' +
          '<dl class="stats" id="stats"></dl>' +
        "</div>" +
        '<button type="button" class="btn" id="theme" data-action="theme">Light theme</button>' +
        "</div></header>" +
        '<div class="wrap">' +
          '<section class="panel" aria-labelledby="browse-heading">' +
            '<div class="panel-head">' +
              '<h2 id="browse-heading">Browse</h2>' +
              '<div class="modes" role="group" aria-label="Browse mode">' +
                '<button type="button" data-action="mode" data-mode="artist" aria-pressed="true">By artist / group</button>' +
                '<button type="button" data-action="mode" data-mode="musician" aria-pressed="false">By musician</button>' +
                '<button type="button" data-action="mode" data-mode="instrument" aria-pressed="false">By instrument</button>' +
                '<button type="button" data-action="mode" data-mode="list" aria-pressed="false">All items</button>' +
              "</div>" +
            "</div>" +
            '<div class="type-row"><span class="type-label" id="type-label">Type</span><div class="modes" id="types" role="group" aria-labelledby="type-label"></div></div>' +
            '<div class="filters">' +
              '<label class="field field-search"><span>Search <kbd>/</kbd></span><input id="q" type="search" placeholder="Artist, show, musician, instrument, outlet" autocomplete="off"></label>' +
              '<label class="field">Genre <select id="genre"></select></label>' +
              '<label class="field">Decade <select id="decade"></select></label>' +
              '<label class="field">Musician <select id="musician"></select></label>' +
              '<label class="field">Instrument <select id="instrument"></select></label>' +
              '<label class="field">Sort by <select id="sort"><option value="artist">Artist A–Z</option><option value="year">Year (oldest first)</option><option value="time">Running time (longest)</option></select></label>' +
            "</div>" +
          "</section>" +
          '<div class="toolbar"><p class="status" id="status" aria-live="polite">Loading the catalog…</p>' +
            '<div class="toolbar-actions">' +
              '<button type="button" class="btn" data-action="prev">Previous</button>' +
              '<button type="button" class="btn" data-action="next">Next</button>' +
              '<button type="button" class="btn" data-action="expand" data-group-only>Expand all</button>' +
              '<button type="button" class="btn" data-action="collapse" data-group-only>Collapse all</button>' +
              '<button type="button" class="btn" data-action="clear">Clear filters</button>' +
              '<button type="button" class="btn" data-action="csv">Download this list</button>' +
            "</div>" +
          "</div>" +
          '<p id="instrument-note" class="section-note" hidden>Shows are filed under each instrument on record for the lineup. A player with no instrument listed, or a credit that only names the band, is left out of this view.</p>' +
          '<div id="results" tabindex="-1"></div>' +
          '<section class="discover" id="discover" aria-labelledby="discover-heading"><div class="discover-head"><h2 id="discover-heading">Discover</h2>' +
            '<button type="button" class="btn btn-primary" data-action="random">Random item</button></div>' +
            '<p class="section-note">Related items are ranked by shared people. When nobody overlaps, other items in the same genre follow.</p>' +
            '<div id="discover-body"></div></section>' +
          '<details class="band-cross"><summary>' +
            '<span class="chev" aria-hidden="true">▸</span>' +
            '<span class="cross-title" id="cross-heading">Musicians who cross bands</span>' +
            '<span class="cross-count" id="cross-count"></span>' +
            '</summary>' +
            '<p class="section-note">On two or more shows. Choose a name to filter every view. The words beside a name are the instruments on file.</p>' +
            '<div id="cross" class="chips"></div></details>' +
          '<footer class="site-footer">' +
            "<p>Watch links open YouTube uploads. Those videos are not hosted here, and the uploads can change or be removed.</p>" +
            '<p><a href="' + esc(csv) + '">Download full spreadsheet</a></p>' +
            '<p class="powered">Powered by <a href="' + esc(home) + '">Live Concert Finder</a></p>' +
          "</footer>" +
        "</div>" +
      "</div>"
    );
  }

  function mount(root, options) {
    const opts = options || {};
    const byId = (id) => root.getElementById(id);
    const themeTarget = opts.themeTarget || document.documentElement;
    const persistTheme = Boolean(opts.persistTheme);
    const defaults = {
      type: typeOption(opts.type),
      artist: opts.artist ? Catalog.artistSlug(opts.artist) : "",
    };
    const state = {
      mode: "artist",
      sort: "artist",
      genre: "All",
      decade: "All",
      musician: "All",
      instrument: "All",
      type: defaults.type,
      artist: defaults.artist,
      query: "",
      page: 0,
      open: {},
      pickId: "",
      seedMode: true,
    };
    let index = null;
    let crossStamp = "";
    let discoverStamp = "";

    function labelInstrument(name) {
      return name.slice(0, 1).toUpperCase() + name.slice(1);
    }

    function noteLabel(note) {
      if (note === "audio-only") return "Audio only";
      if (note === "partial") return "Partial";
      return note;
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
      const select = byId(id);
      const choices = ['<option value="All">All</option>'];
      for (const value of values) {
        const label = labeler ? labeler(value) : value;
        choices.push('<option value="' + esc(value) + '">' + esc(label) + "</option>");
      }
      select.innerHTML = choices.join("");
      select.value = "All";
    }

    function musicianOptionLabel(name) {
      const instruments = index.instrumentsFor(name).map(labelInstrument);
      return instruments.length ? name + " · " + instruments.join(", ") : name;
    }

    function searchButton(name, className, marked) {
      const on = marked || Catalog.fold(state.query) === Catalog.fold(name) ? " is-on" : "";
      return '<button type="button" class="' + className + on + '" data-action="search" data-query="' + esc(name) + '" aria-label="Search for ' + esc(name) + '">' + esc(name) + "</button>";
    }

    function musicianChip(name, withCount) {
      const instruments = index.instrumentsFor(name);
      const nameHtml = searchButton(name, "chip-btn", state.musician === name);
      const instHtml = instruments.map((instrument) => {
        const on = state.instrument === instrument ? " is-on" : "";
        return '<button type="button" class="inst-btn' + on + '" data-action="instrument" data-name="' + esc(instrument) + '" aria-label="Filter by ' + esc(labelInstrument(instrument)) + '">' + esc(labelInstrument(instrument)) + "</button>";
      }).join("");
      const countHtml = withCount ? '<span class="chip-count">' + index.musicianCount[name] + "</span>" : "";
      return '<span class="chip">' + nameHtml + (instHtml ? '<span class="chip-insts">' + instHtml + "</span>" : "") + countHtml + "</span>";
    }

    function typePhrase(items) {
      const counts = Catalog.countByType(items);
      return Catalog.TYPES.filter((type) => counts[type.id]).map((type) => {
        const count = counts[type.id];
        return count + " " + (count === 1 ? type.label : type.plural).toLowerCase();
      }).join(", ");
    }

    function concertArticle(concert, articleOptions) {
      const grouped = Boolean(articleOptions && articleOptions.grouped);
      const feature = Boolean(articleOptions && articleOptions.feature);
      const pivot = Boolean(articleOptions && articleOptions.pivot);
      const shared = articleOptions && articleOptions.shared;
      const titleTag = feature || !grouped ? "h3" : "h4";
      const yearHtml = concert.year ? "<span>" + concert.year + "</span>" : "";
      const kind = Catalog.typeInfo(Catalog.itemType(concert));
      const typeBadge = '<span class="type-badge is-' + esc(kind.id) + '">' + esc(kind.label) + "</span>";
      const note = concert.notes ? '<span class="badge">' + esc(noteLabel(concert.notes)) + "</span>" : "";
      const bylineBits = [];
      if (concert.outlet) bylineBits.push(concert.outlet);
      if (concert.interviewer) bylineBits.push("Interviewed by " + concert.interviewer);
      const byline = bylineBits.length ? '<p class="byline">' + esc(bylineBits.join(" · ")) + "</p>" : "";
      const creditList = Catalog.creditsFor(concert);
      const creditsHtml = creditList.length
        ? '<p class="credits">' + creditList.map((credit) => esc(credit.role ? credit.name + " · " + credit.role : credit.name)).join('<span class="credits-gap"> · </span>') + "</p>"
        : "";
      const people = Catalog.lineup(concert);
      let sharedHtml = "";
      if (Array.isArray(shared)) {
        const text = shared.length ? "Shared: " + shared.join(", ") : "Same genre: " + concert.genre;
        sharedHtml = '<p class="shared">' + esc(text) + "</p>";
      }
      const pivotHtml = pivot
        ? '<button type="button" class="text-btn" data-action="similar" data-id="' + esc(concert.id) + '">Related</button>'
        : "";
      const watchHref = Catalog.youtubeUrl(concert.id);
      const trainerHref = Catalog.trainerUrl(concert.id);
      const links =
        '<div class="video-links">' +
          '<a class="watch" href="' + watchHref + '"' + Catalog.linkAttrs(watchHref) + ' aria-label="View ' + esc(concert.title) + ' on YouTube">View on YouTube</a>' +
          '<a class="trainer" href="' + trainerHref + '"' + Catalog.linkAttrs(trainerHref) + ' aria-label="Open ' + esc(concert.title) + ' on YT Trainer">Open on YT Trainer</a>' +
        "</div>";
      return (
        '<article class="concert' + (feature ? " is-feature" : "") + '">' +
          '<div class="thumb-wrap"><button type="button" class="play" data-action="play" data-id="' + esc(concert.id) + '" aria-label="Play ' + esc(concert.title) + '">' +
            '<img class="thumb" alt="" width="320" height="180" loading="lazy" decoding="async" src="' + thumb(concert.id) + '" onerror="this.classList.add(\'is-broken\')">' +
            '<span class="play-mark" aria-hidden="true">Play</span>' +
          "</button></div>" +
          '<div class="concert-body">' +
            '<div class="concert-top">' +
              "<" + titleTag + ' class="concert-title">' + esc(concert.title) + "</" + titleTag + ">" +
              links +
            "</div>" +
            '<p class="meta">' +
              searchButton(concert.artist, "name-link") +
              yearHtml +
              typeBadge +
              '<span class="genre"><i style="background:' + genreColor(concert.genre) + '"></i>' + esc(concert.genre) + "</span>" +
              '<span class="time">' + esc(Catalog.formatDuration(concert.durationSeconds)) + "</span>" +
              note +
            "</p>" +
            byline +
            creditsHtml +
            '<div class="chips">' + people.map((person) => musicianChip(person.name, false)).join("") + "</div>" +
            sharedHtml +
            pivotHtml +
          "</div>" +
        "</article>"
      );
    }

    function groupBlock(group) {
      const id = groupId(group.key);
      const open = Boolean(state.open[id]);
      const person = state.mode === "artist" || state.mode === "musician";
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
      let titleHtml;
      if (state.mode === "musician") {
        const instruments = index.instrumentsFor(group.key).map(labelInstrument);
        titleHtml = searchButton(group.key, "group-title") + (instruments.length ? '<span class="group-instruments"> · ' + esc(instruments.join(", ")) + "</span>" : "");
      } else if (state.mode === "artist") {
        titleHtml = searchButton(group.key, "group-title");
      } else {
        titleHtml = '<button type="button" class="group-title" data-action="group" data-group="' + esc(id) + '">' + esc(labelInstrument(group.key)) + "</button>";
      }
      const label = person ? group.key : labelInstrument(group.key);
      const meta = typePhrase(group.items) + " · " + Catalog.formatDuration(group.seconds) + " total" + extra;
      const body = open
        ? '<div class="group-body">' + group.items.map((concert) => concertArticle(concert, { grouped: true, pivot: true })).join("") + "</div>"
        : "";
      return (
        '<section class="group' + (open ? " is-open" : "") + '">' +
          '<h3 class="group-head">' +
            '<span class="group-main">' +
              '<button type="button" class="chev-btn" data-action="group" data-group="' + esc(id) + '" aria-expanded="' + (open ? "true" : "false") + '" aria-label="' + (open ? "Collapse " : "Expand ") + esc(label) + '">' +
                '<span class="chev" aria-hidden="true">▸</span>' +
              "</button>" +
              titleHtml +
            "</span>" +
            '<button type="button" class="group-meta" data-action="group" data-group="' + esc(id) + '">' + esc(meta) + "</button>" +
          "</h3>" +
          body +
        "</section>"
      );
    }

    function appearsHtml(rows) {
      const found = Catalog.appearances(state.query, rows);
      if (!found.length) return "";
      return '<div class="appears">' + found.slice(0, 3).map((person) => {
        const shown = person.acts.slice(0, 12);
        const links = shown.map((act) => '<button type="button" class="act-link" data-action="search" data-query="' + esc(act) + '">' + esc(act) + "</button>").join('<span class="act-sep">, </span>');
        const more = person.acts.length > shown.length ? '<span class="act-sep">…</span>' : "";
        return "<p>" + searchButton(person.name, "name-link") + " appears in: " + links + more + "</p>";
      }).join("") + "</div>";
    }

    function emptyState(message) {
      return '<div class="empty"><p>' + esc(message) + '</p><button type="button" class="btn" data-action="clear">Clear filters</button></div>';
    }

    function pager(pages) {
      if (pages < 2) return "";
      const prev = state.page === 0 ? " disabled" : "";
      const next = state.page >= pages - 1 ? " disabled" : "";
      return '<nav class="pager" aria-label="Pagination"><button type="button" class="btn" data-action="prev"' + prev + ">Previous</button><button type=\"button\" class=\"btn\" data-action=\"next\"" + next + ">Next</button></nav>";
    }

    function render(scroll) {
      if (!index) return;
      const active = root.activeElement;
      const focusGroup = active && active.getAttribute && active.getAttribute("data-group");
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
      byId("status").textContent = "Page " + (state.page + 1) + " of " + pages + " · " + concertLabel + groupLabel;

      const note = appearsHtml(rows);
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
      byId("results").innerHTML = note + results;

      const cross = byId("cross");
      const nextCross = state.musician + "\0" + state.instrument;
      if (cross && nextCross !== crossStamp) {
        crossStamp = nextCross;
        cross.innerHTML = index.crossMusicians.map((name) => musicianChip(name, true)).join("");
      }

      const discoverBody = byId("discover-body");
      if (discoverBody && state.pickId !== discoverStamp) {
        discoverStamp = state.pickId;
        const pick = index.concerts.find((concert) => concert.id === state.pickId) || index.concerts[0];
        const similar = pick ? Catalog.related(pick, index.concerts, 5) : [];
        const relatedHtml = similar.length
          ? '<h3 class="subhead">Related</h3>' + similar.map((item) => concertArticle(item.concert, { shared: item.shared })).join("")
          : '<p class="section-note">No related shows yet.</p>';
        discoverBody.innerHTML = (pick ? concertArticle(pick, { feature: true }) : "") + relatedHtml;
      }

      syncControls(pages);
      if (focusGroup) {
        const again = [...root.querySelectorAll("[data-group]")].find((node) => node.getAttribute("data-group") === focusGroup);
        if (again) again.focus();
      }
      if (scroll) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        byId("results").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
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
      const query = byId("q");
      if (query && query.value !== state.query) query.value = state.query;
      for (const id of ["genre", "decade", "musician", "instrument", "sort"]) {
        const el = byId(id);
        if (el && el.value !== state[id]) el.value = state[id];
      }
      root.querySelectorAll("[data-mode]").forEach((button) => {
        button.setAttribute("aria-pressed", button.getAttribute("data-mode") === state.mode ? "true" : "false");
      });
      root.querySelectorAll("[data-type]").forEach((button) => {
        button.setAttribute("aria-pressed", button.getAttribute("data-type") === state.type ? "true" : "false");
      });
      root.querySelectorAll("[data-group-only]").forEach((button) => {
        button.hidden = state.mode === "list";
      });
      const instrumentNote = byId("instrument-note");
      if (instrumentNote) instrumentNote.hidden = state.mode !== "instrument";
      root.querySelectorAll('[data-action="prev"]').forEach((button) => {
        button.disabled = state.page === 0;
      });
      root.querySelectorAll('[data-action="next"]').forEach((button) => {
        button.disabled = state.page >= pages - 1;
      });
      const theme = themeTarget.getAttribute("data-theme") === "light" ? "light" : "dark";
      const themeButton = byId("theme");
      if (themeButton) {
        themeButton.textContent = theme === "light" ? "Dark theme" : "Light theme";
        themeButton.setAttribute("aria-label", theme === "light" ? "Switch to dark theme" : "Switch to light theme");
      }
    }

    function toggleTheme() {
      const next = themeTarget.getAttribute("data-theme") === "light" ? "dark" : "light";
      themeTarget.setAttribute("data-theme", next);
      if (persistTheme) {
        try { localStorage.setItem("lcf-theme", next); } catch (error) {}
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", next === "light" ? "#f4f0e7" : "#12100d");
      }
      render(false);
    }

    function runSearch(query, scroll) {
      state.query = query;
      state.page = 0;
      const next = clearedFilters(index, state, query);
      state.genre = next.genre;
      state.decade = next.decade;
      state.musician = next.musician;
      state.instrument = next.instrument;
      state.type = next.type;
      state.artist = next.artist;
      render(Boolean(scroll));
    }

    function clearFilters() {
      state.genre = "All";
      state.decade = "All";
      state.musician = "All";
      state.instrument = "All";
      state.type = defaults.type;
      state.artist = defaults.artist;
      state.query = "";
      state.page = 0;
    }

    function downloadCsv(filename, text) {
      const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function scrollToDiscover() {
      const discover = byId("discover");
      if (!discover) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      discover.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
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
      } else if (action === "search") {
        runSearch(el.getAttribute("data-query") || "", true);
      } else if (action === "clear") {
        clearFilters();
        render(false);
      } else if (action === "csv") {
        if (!index) return;
        downloadCsv("live-concert-finder.csv", Catalog.toCsv(currentRows(), index));
      } else if (action === "play") {
        const wrap = el.closest(".thumb-wrap");
        const id = el.getAttribute("data-id") || "";
        if (!wrap || !id) return;
        wrap.innerHTML = '<iframe class="player" title="YouTube video player" width="320" height="180" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1"></iframe>';
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

    function bind() {
      root.addEventListener("click", onClick);
      const typeRoot = byId("types");
      typeRoot.innerHTML = '<button type="button" data-action="type" data-type="All" aria-pressed="true">All</button>' +
        Catalog.TYPES.map((type) => '<button type="button" data-action="type" data-type="' + type.id + '" aria-pressed="false">' + type.plural + "</button>").join("");
      byId("q").addEventListener("input", (event) => {
        state.query = event.target.value;
        state.page = 0;
        render(false);
      });
      for (const id of ["genre", "decade", "musician", "instrument", "sort"]) {
        byId(id).addEventListener("change", (event) => {
          state[id] = event.target.value;
          state.page = 0;
          render(false);
        });
      }
      root.addEventListener("keydown", (event) => {
        if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
        const tag = event.target && event.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        event.preventDefault();
        byId("q").focus();
      });
    }

    const concerts = opts.concerts;
    const musicians = opts.musicians || {};
    if (!Array.isArray(concerts)) throw new Error("concerts");
    index = Catalog.buildIndex(concerts, musicians);
    state.pickId = concerts.some((concert) => concert.id === "5XB7iPsCjC4") ? "5XB7iPsCjC4" : (concerts[0] ? concerts[0].id : "");
    bind();
    fillSelect("genre", index.genres);
    fillSelect("decade", index.decades);
    fillSelect("musician", index.musicianNames, musicianOptionLabel);
    fillSelect("instrument", index.instruments, labelInstrument);
    const seconds = concerts.reduce((sum, concert) => sum + concert.durationSeconds, 0);
    const typeCounts = Catalog.countByType(concerts);
    const typeStats = Catalog.TYPES.filter((type) => typeCounts[type.id]).map((type) => stat(type.plural, String(typeCounts[type.id]))).join("");
    const stats = byId("stats");
    if (stats) {
      stats.innerHTML =
        typeStats +
        stat("Listening time", formatLong(seconds)) +
        stat("Musicians", String(index.musicianNames.length)) +
        stat("Genres", String(index.genres.length));
    }
    const summary = byId("summary");
    if (summary) {
      summary.textContent = typePhrase(concerts) + " on YouTube, grouped by artist and linked by the people in them. Running times are the real video lengths.";
    }
    const crossCount = byId("cross-count");
    if (crossCount) {
      const count = index.crossMusicians.length;
      crossCount.textContent = count + " musician" + (count === 1 ? "" : "s");
    }
    render(false);
    return { root };
  }

  return { mount, shellHtml, typeOption, clearedFilters };
});
