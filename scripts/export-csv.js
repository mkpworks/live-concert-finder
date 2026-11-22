"use strict";

const fs = require("fs");
const path = require("path");
const Catalog = require("../js/catalog.js");

const root = path.join(__dirname, "..");
const outPath = path.resolve(process.argv[2] || path.join(root, "data", "catalog.csv"));

const concerts = JSON.parse(fs.readFileSync(path.join(root, "data", "concerts.json"), "utf8"));
const musicians = JSON.parse(fs.readFileSync(path.join(root, "data", "musicians.json"), "utf8"));
const index = Catalog.buildIndex(concerts, musicians);
const rows = Catalog.sortConcerts(concerts, "artist");
const csv = Catalog.toCsv(rows, index);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, csv);
console.log("Wrote " + rows.length + " rows to " + outPath);
