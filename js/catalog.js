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

  function uniqueSorted(values) {
    return [...new Set(values)].sort(compareNames);
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
    const musicianNames = Object.keys(musicianCount).sort(compareNames);
    const instrumentSet = new Set();
    for (const name of musicianNames) {
      const list = instrumentsByMusician[name];
      if (!Array.isArray(list)) continue;
      for (const instrument of list) instrumentSet.add(instrument);
    }
    const genres = uniqueSorted(concerts.map((concert) => concert.genre));
    const decades = uniqueSorted(concerts.map((concert) => decadeOf(concert.year)));
    decades.sort((a, b) => {
      if (a === "Unknown") return 1;
      if (b === "Unknown") return -1;
      return a.localeCompare(b);
    });
    const instruments = [...instrumentSet].sort(compareNames);
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
    const query = ((filters && filters.query) || "").trim().toLowerCase();
    const people = lineup(concert);
    const names = people.map((entry) => entry.name);
    if (type !== "All" && itemType(concert) !== type) return false;
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
        index.concertInstruments(concert).join(" "),
      ].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
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

  function pageCount(total) {
    return Math.max(1, Math.ceil(total / PER_PAGE));
  }

  return {
    PER_PAGE,
    TYPES,
    typeInfo,
    itemType,
    lineup,
    creditsFor,
    countByType,
    formatDuration,
    decadeOf,
    buildIndex,
    matches,
    sortConcerts,
    groupConcerts,
    related,
    pageCount,
  };
});
