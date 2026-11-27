"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Catalog = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PER_PAGE = 12;

  // Add a category here. The id is what data/concerts.json stores in `type`.
  const TYPES = [
    { id: "concert", label: "Concert", plural: "Concerts" },
    { id: "interview", label: "Interview", plural: "Interviews" },
  ];

  function typeInfo(id) {
    return TYPES.find((type) => type.id === id) || null;
  }

  function itemType(item) {
    const id = item && item.type;
    if (typeof id === "string" && typeInfo(id)) return id;
    return "concert";
  }

  function creditsFor(item) {
    if (!item || !Array.isArray(item.credits)) return [];
    const credits = [];
    for (const credit of item.credits) {
      if (!credit || typeof credit.name !== "string" || !credit.name.trim()) continue;
      credits.push({
        name: credit.name,
        role: typeof credit.role === "string" ? credit.role.trim() : "",
      });
    }
    return credits;
  }

  function lineup(item) {
    if (!item || !Array.isArray(item.musicians)) return [];
    const roles = {};
    for (const credit of creditsFor(item)) roles[credit.name] = credit.role;
    const entries = [];
    for (const name of item.musicians) {
      if (typeof name === "string" && name.trim()) entries.push({ name, role: roles[name] || "" });
    }
    return entries;
  }

  function lineupNames(item) {
    return lineup(item).map((entry) => entry.name);
  }

  function countByType(items) {
    const counts = {};
    for (const type of TYPES) counts[type.id] = 0;
    for (const item of items) counts[itemType(item)] += 1;
    return counts;
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return hours + ":" + String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  }

  function decadeOf(year) {
    if (!year) return "Unknown";
    return Math.floor(year / 10) * 10 + "s";
  }

  function yearKey(year) {
    return year || 9999;
  }

  function compareNames(a, b) {
    return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
  }

  // Dropdown and facet labels. Case and accents are ignored, and a number
  // counts by its value, so "Item 2" stays before "Item 10" and "Funk" before "Triads".
  function compareOptions(a, b) {
    return String(a).localeCompare(String(b), undefined, { sensitivity: "base", numeric: true });
  }

  // Placeholders such as "All", "Any", and "All instruments" stay first.
  function isPlaceholderOption(text) {
    return /^(?:all|any)(?:\s|$)/i.test(String(text == null ? "" : text).trim());
  }

  function optionLabel(entry) {
    if (entry && entry.label != null) return entry.label;
    if (entry && entry.value != null) return entry.value;
    return "";
  }

  function sortSelectOptions(entries) {
    return entries.slice().sort((a, b) => {
      const aLabel = optionLabel(a);
      const bLabel = optionLabel(b);
      const ap = isPlaceholderOption(aLabel) || isPlaceholderOption(a && a.value);
      const bp = isPlaceholderOption(bLabel) || isPlaceholderOption(b && b.value);
      if (ap !== bp) return ap ? -1 : 1;
      return compareOptions(aLabel, bLabel);
    });
  }

  function fold(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function artistSlug(name) {
    return fold(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  // One place for the YT Trainer link. The id is appended as video_id.
  const YT_TRAINER_BASE = "https://ytmusictrainer.com/?video_id=";
  const TRAINER_HOST = "ytmusictrainer.com";

  function trainerUrl(id) {
    return YT_TRAINER_BASE + encodeURIComponent(id || "");
  }

  function normalizedHost(value) {
    return String(value == null ? "" : value).trim().toLowerCase().replace(/\.+$/, "");
  }

  // ytmusictrainer.com itself, or a subdomain such as www.
  function isTrainerHost(hostname) {
    const host = normalizedHost(hostname);
    return host === TRAINER_HOST || host.endsWith("." + TRAINER_HOST);
  }

  function urlHost(href) {
    const text = String(href == null ? "" : href).trim();
    if (!text) return "";
    const absolute = /^[a-z][a-z0-9+.-]*:/i.test(text) || text.slice(0, 2) === "//";
    if (!absolute) return "";
    try {
      return normalizedHost(new URL(text, "https://ytmusictrainer.invalid").hostname);
    } catch (error) {
      return "";
    }
  }

  function pageHost(hostname) {
    if (hostname != null) return hostname;
    try {
      const scope = typeof window !== "undefined" ? window : globalThis;
      return scope && scope.location ? scope.location.hostname : "";
    } catch (error) {
      return "";
    }
  }

  // New-tab attributes for an outbound link. A link to ytmusictrainer.com
  // stays in this tab when the hosting page is already on that site.
  // Pass hostname to override window.location.hostname (tests, and callers
  // that already know the host).
  function linkAttrs(href, hostname) {
    const dest = urlHost(href);
    if (!dest) return "";
    if (isTrainerHost(dest) && isTrainerHost(pageHost(hostname))) return "";
    return ' target="_blank" rel="noopener noreferrer"';
  }

  function uniqueSorted(values) {
    return [...new Set(values)].sort(compareOptions);
  }

  function buildIndex(concerts, musicianInstruments) {
    const instrumentsByMusician = musicianInstruments || {};
    const EMPTY_INSTRUMENTS = [];
    const musicianCount = {};
    for (const concert of concerts) {
      for (const name of lineupNames(concert)) {
        musicianCount[name] = (musicianCount[name] || 0) + 1;
      }
    }
    const musicianNames = Object.keys(musicianCount).sort(compareOptions);
    const instrumentSet = new Set();
    for (const name of musicianNames) {
      const list = instrumentsByMusician[name];
      if (!Array.isArray(list)) continue;
      for (const instrument of list) instrumentSet.add(instrument);
    }
    const genres = uniqueSorted(concerts.map((concert) => concert.genre));
    const decades = uniqueSorted(concerts.map((concert) => decadeOf(concert.year)));
    // Chronological, with unknown years last.
    decades.sort((a, b) => {
      if (a === "Unknown") return 1;
      if (b === "Unknown") return -1;
      return a.localeCompare(b);
    });
    const instruments = [...instrumentSet].sort(compareOptions);
    const crossMusicians = musicianNames
      .filter((name) => musicianCount[name] > 1)
      .sort((a, b) => musicianCount[b] - musicianCount[a] || compareNames(a, b));

    function instrumentsFor(name) {
      const list = instrumentsByMusician[name];
      return Array.isArray(list) ? list : EMPTY_INSTRUMENTS;
    }

    function concertInstruments(concert) {
      const found = new Set();
      for (const name of lineupNames(concert)) {
        for (const instrument of instrumentsFor(name)) found.add(instrument);
      }
      return [...found];
    }

    return {
      concerts,
      musicianCount,
      musicianNames,
      genres,
      decades,
      instruments,
      crossMusicians,
      instrumentsFor,
      concertInstruments,
    };
  }

  function matches(concert, filters, index) {
    const genre = (filters && filters.genre) || "All";
    const decade = (filters && filters.decade) || "All";
    const musician = (filters && filters.musician) || "All";
    const instrument = (filters && filters.instrument) || "All";
    const type = (filters && filters.type) || "All";
    const artist = (filters && filters.artist) || "";
    const query = fold((filters && filters.query) || "").trim();
    const people = lineup(concert);
    const names = people.map((entry) => entry.name);
    if (type !== "All" && itemType(concert) !== type) return false;
    if (artist && artist !== "All" && artistSlug(concert.artist) !== artistSlug(artist)) return false;
    if (genre !== "All" && concert.genre !== genre) return false;
    if (decade !== "All" && decadeOf(concert.year) !== decade) return false;
    if (musician !== "All" && !names.includes(musician)) return false;
    if (instrument !== "All") {
      const plays = names.some((name) => index.instrumentsFor(name).includes(instrument));
      if (!plays) return false;
    }
    if (query) {
      const typeName = typeInfo(itemType(concert));
      const haystack = [
        concert.artist,
        concert.title,
        concert.genre,
        concert.notes || "",
        concert.outlet || "",
        concert.interviewer || "",
        typeName ? typeName.label + " " + typeName.plural : "",
        people.map((entry) => entry.name + " " + entry.role).join(" "),
        creditsFor(concert).map((credit) => credit.name).join(" "),
        index.concertInstruments(concert).join(" "),
      ].join(" ");
      if (!fold(haystack).includes(query)) return false;
    }
    return true;
  }

  function sortConcerts(list, sort) {
    const copy = list.slice();
    copy.sort((a, b) => {
      if (sort === "year") {
        return yearKey(a.year) - yearKey(b.year) || compareNames(a.artist, b.artist) || compareNames(a.title, b.title);
      }
      if (sort === "time") {
        return b.durationSeconds - a.durationSeconds || compareNames(a.artist, b.artist) || compareNames(a.title, b.title);
      }
      return compareNames(a.artist, b.artist) || yearKey(a.year) - yearKey(b.year) || compareNames(a.title, b.title);
    });
    return copy;
  }

  function groupConcerts(rows, mode, sort, options) {
    const index = options.index;
    const musicianFilter = options.musician || "All";
    const query = (options.query || "").trim();
    const map = new Map();
    if (mode === "list") return [];
    for (const concert of rows) {
      let keys;
      if (mode === "musician") keys = lineupNames(concert);
      else if (mode === "instrument") keys = index.concertInstruments(concert);
      else keys = [concert.artist];
      for (const key of new Set(keys)) {
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(concert);
      }
    }
    let keys = [...map.keys()];
    // With no musician filter and no search, hide players who only appear once.
    if (mode === "musician" && musicianFilter === "All" && !query) {
      keys = keys.filter((key) => map.get(key).length > 1 || index.musicianCount[key] > 1);
    }
    keys.sort((a, b) => {
      const left = map.get(a);
      const right = map.get(b);
      if (sort === "time") {
        const leftSeconds = left.reduce((sum, concert) => sum + concert.durationSeconds, 0);
        const rightSeconds = right.reduce((sum, concert) => sum + concert.durationSeconds, 0);
        return rightSeconds - leftSeconds || compareNames(a, b);
      }
      if (sort === "year") {
        const leftYear = Math.min(...left.map((concert) => yearKey(concert.year)));
        const rightYear = Math.min(...right.map((concert) => yearKey(concert.year)));
        return leftYear - rightYear || compareNames(a, b);
      }
      return compareNames(a, b);
    });
    return keys.map((key) => {
      const items = map.get(key);
      return {
        key,
        items,
        shows: items.length,
        seconds: items.reduce((sum, concert) => sum + concert.durationSeconds, 0),
      };
    });
  }

  function related(concert, concerts, limit) {
    const max = limit || 5;
    return concerts
      .filter((other) => other.id !== concert.id && (lineupNames(other).some((name) => lineupNames(concert).includes(name)) || other.genre === concert.genre))
      .map((other) => ({
        concert: other,
        shared: lineupNames(other).filter((name) => lineupNames(concert).includes(name)),
      }))
      .sort((a, b) => b.shared.length - a.shared.length || compareNames(a.concert.artist, b.concert.artist) || compareNames(a.concert.title, b.concert.title))
      .slice(0, max);
  }

  function appearances(query, items) {
    const needle = fold(query).trim();
    if (needle.length < 2) return [];
    const map = new Map();
    for (const item of items) {
      const names = new Set(lineupNames(item));
      for (const credit of creditsFor(item)) names.add(credit.name);
      for (const name of names) {
        if (!fold(name).includes(needle)) continue;
        if (!map.has(name)) map.set(name, new Set());
        if (item.artist) map.get(name).add(item.artist);
      }
    }
    return [...map.entries()]
      .map(([name, acts]) => ({ name, acts: [...acts].sort(compareNames) }))
      .sort((a, b) => b.acts.length - a.acts.length || compareNames(a.name, b.name));
  }

  function pageCount(total) {
    return Math.max(1, Math.ceil(total / PER_PAGE));
  }

  // One spreadsheet column. Several instruments stay in this cell, joined like the lineup.
  const CSV_HEADERS = [
    "type",
    "artist",
    "title",
    "year",
    "genre",
    "duration_seconds",
    "duration",
    "featured_instrument",
    "musicians",
    "interviewer",
    "outlet",
    "credits",
    "youtube_url",
    "ytmusictrainer_url",
    "id",
  ];

  function labelInstrument(name) {
    return name.slice(0, 1).toUpperCase() + name.slice(1);
  }

  function csvField(value) {
    const text = value == null ? "" : String(value);
    if (/[",\r\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function featuredInstruments(item, index) {
    if (!index || typeof index.instrumentsFor !== "function") return "";
    const found = [];
    const seen = new Set();
    for (const name of lineupNames(item)) {
      for (const instrument of index.instrumentsFor(name)) {
        if (seen.has(instrument)) continue;
        seen.add(instrument);
        found.push(labelInstrument(instrument));
      }
    }
    return found.join("; ");
  }

  function creditCell(item) {
    return creditsFor(item).map((credit) => (credit.role ? credit.name + " (" + credit.role + ")" : credit.name)).join("; ");
  }

  function youtubeUrl(id) {
    return "https://www.youtube.com/watch?v=" + encodeURIComponent(id || "");
  }

  function csvRow(item, index) {
    const seconds = Math.max(0, Math.floor(Number(item && item.durationSeconds) || 0));
    const values = [
      itemType(item),
      (item && item.artist) || "",
      (item && item.title) || "",
      item && item.year ? String(item.year) : "",
      (item && item.genre) || "",
      String(seconds),
      formatDuration(seconds),
      featuredInstruments(item, index),
      lineupNames(item).join("; "),
      (item && item.interviewer) || "",
      (item && item.outlet) || "",
      creditCell(item),
      youtubeUrl(item && item.id),
      trainerUrl(item && item.id),
      (item && item.id) || "",
    ];
    return values.map(csvField).join(",");
  }

  // UTF-8 BOM plus CRLF so Excel keeps accents and row breaks.
  function toCsv(items, index) {
    const lines = [CSV_HEADERS.join(",")];
    for (const item of items || []) lines.push(csvRow(item, index));
    return "\uFEFF" + lines.join("\r\n") + "\r\n";
  }

  return {
    PER_PAGE,
    TYPES,
    CSV_HEADERS,
    typeInfo,
    itemType,
    lineup,
    creditsFor,
    countByType,
    formatDuration,
    decadeOf,
    buildIndex,
    compareOptions,
    sortSelectOptions,
    matches,
    sortConcerts,
    groupConcerts,
    appearances,
    fold,
    artistSlug,
    related,
    pageCount,
    toCsv,
    youtubeUrl,
    YT_TRAINER_BASE,
    trainerUrl,
    linkAttrs,
  };
});
