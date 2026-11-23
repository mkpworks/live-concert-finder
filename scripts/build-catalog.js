"use strict";

const fs = require("fs");
const path = require("path");

const SCHEMA_VERSION = "1";
const root = path.join(__dirname, "..");
const outDir = path.resolve(process.argv[2] || path.join(root, "data"));
const concerts = JSON.parse(fs.readFileSync(path.join(root, "data", "concerts.json"), "utf8"));
const musicians = JSON.parse(fs.readFileSync(path.join(root, "data", "musicians.json"), "utf8"));
const generatedAt = new Date().toISOString();
const catalog = {
  version: SCHEMA_VERSION,
  generated_at: generatedAt,
  concerts,
  musicians,
};
const version = {
  version: SCHEMA_VERSION,
  generated_at: generatedAt,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "catalog.json"), JSON.stringify(catalog));
fs.writeFileSync(path.join(outDir, "version.json"), JSON.stringify(version));
console.log("Wrote catalog v" + SCHEMA_VERSION + " (" + concerts.length + " items) to " + outDir);
