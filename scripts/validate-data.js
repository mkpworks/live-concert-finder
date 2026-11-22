"use strict";

const fs = require("fs");
const path = require("path");

const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const INSTRUMENT_RE = /^[A-Za-z0-9]+(?:[ /-][A-Za-z0-9]+)*$/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validate(concerts, musicians) {
  const errors = [];
  if (!Array.isArray(concerts)) {
    errors.push("concerts must be an array");
    return errors;
  }
  if (!isPlainObject(musicians)) {
    errors.push("musicians must be an object mapping names to instrument lists");
    return errors;
  }

  const seen = new Set();
  concerts.forEach((concert, index) => {
    const where = "concerts[" + index + "]";
    if (!isPlainObject(concert)) {
      errors.push(where + " must be an object");
      return;
    }
    if (typeof concert.id !== "string" || !ID_RE.test(concert.id)) {
      errors.push(where + " id must be an 11-character YouTube id");
    } else if (seen.has(concert.id)) {
      errors.push("duplicate id " + concert.id);
    } else {
      seen.add(concert.id);
    }
    for (const field of ["artist", "title", "genre"]) {
      if (typeof concert[field] !== "string" || !concert[field].trim()) {
        errors.push(where + " " + field + " is required");
      }
    }
    if (!Number.isInteger(concert.year) || concert.year < 0) {
      errors.push(where + " year must be a whole number (0 if unknown)");
    }
    if (!Number.isInteger(concert.durationSeconds) || concert.durationSeconds <= 0) {
      errors.push(where + " durationSeconds must be a positive whole number");
    }
    if (!Array.isArray(concert.musicians) || concert.musicians.length === 0) {
      errors.push(where + " musicians must be a non-empty list");
    } else {
      const names = new Set();
      concert.musicians.forEach((name, nameIndex) => {
        if (typeof name !== "string" || !name.trim()) {
          errors.push(where + " musicians[" + nameIndex + "] must be a non-empty string");
          return;
        }
        if (names.has(name)) errors.push(where + " lists " + name + " more than once");
        names.add(name);
      });
    }
    if (concert.notes !== undefined && (typeof concert.notes !== "string" || !concert.notes.trim())) {
      errors.push(where + " notes must be a non-empty string when present");
    }
  });

  Object.keys(musicians).forEach((name) => {
    if (!name.trim()) {
      errors.push("musicians has an empty name");
      return;
    }
    const list = musicians[name];
    if (!Array.isArray(list) || list.length === 0) {
      errors.push("musicians " + JSON.stringify(name) + " needs a non-empty instrument list");
      return;
    }
    const seenInst = new Set();
    list.forEach((instrument, index) => {
      if (typeof instrument !== "string" || !INSTRUMENT_RE.test(instrument)) {
        errors.push("musicians " + JSON.stringify(name) + "[" + index + "] must be an instrument name");
        return;
      }
      if (seenInst.has(instrument)) errors.push("musicians " + JSON.stringify(name) + " repeats " + instrument);
      seenInst.add(instrument);
    });
  });

  return errors;
}

function loadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error("Could not read " + file + ": " + error.message);
  }
}

function main() {
  const root = path.join(__dirname, "..");
  const concertFile = process.argv[2] || path.join(root, "data", "concerts.json");
  const musicianFile = process.argv[3] || path.join(root, "data", "musicians.json");
  let concerts;
  let musicians;
  try {
    concerts = loadJson(concertFile);
    musicians = loadJson(musicianFile);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const errors = validate(concerts, musicians);
  if (errors.length) {
    console.error("Invalid concert data (" + errors.length + ")");
    for (const error of errors) console.error(" - " + error);
    process.exit(1);
  }
  const uncovered = [];
  const seen = new Set();
  for (const concert of concerts) {
    for (const name of concert.musicians) {
      if (seen.has(name)) continue;
      seen.add(name);
      if (!Object.prototype.hasOwnProperty.call(musicians, name)) uncovered.push(name);
    }
  }
  uncovered.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  console.log("OK: " + concerts.length + " concerts, " + Object.keys(musicians).length + " musician instrument lists");
  if (uncovered.length) {
    console.log("Musicians without instruments (" + uncovered.length + "): " + uncovered.join(", "));
  }
}

module.exports = { validate };

if (require.main === module) main();
