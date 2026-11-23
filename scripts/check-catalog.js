"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const Catalog = require("../js/catalog.js");
const { validate } = require("./validate-data.js");

const root = path.join(__dirname, "..");
const concerts = JSON.parse(fs.readFileSync(path.join(root, "data", "concerts.json"), "utf8"));
const musicians = JSON.parse(fs.readFileSync(path.join(root, "data", "musicians.json"), "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message || "assertion failed");
}

const errors = validate(concerts, musicians);
if (errors.length) {
  console.error(errors.join("\n"));
  throw new Error("seed data failed validation");
}

const duplicate = concerts.map((concert) => ({ ...concert, musicians: concert.musicians.slice() }));
duplicate.push({ ...duplicate[0], musicians: duplicate[0].musicians.slice() });
assert(validate(duplicate, musicians).some((error) => error.includes("duplicate id")), "duplicate id");
const missingTitle = concerts.map((concert) => ({ ...concert }));
delete missingTitle[0].title;
assert(validate(missingTitle, musicians).some((error) => error.includes("title")), "missing title");
assert(validate(concerts, ["bass"]).some((error) => error.includes("object")), "musicians shape");
assert(validate(concerts, { Ada: ["guitar!"] }).some((error) => error.includes("instrument name")), "instrument shape");
assert(validate(concerts, { Ada: ["DJ"] }).length === 0, "DJ is a valid instrument name");

assert(concerts.length >= 1776, "concert count");
for (const id of ["0wtqnKXZlWk", "5XB7iPsCjC4", "btIIPIPDO4U", "4fPKcqx87Yc", "TAMx_nkKqDg", "C_mFOnzglU8"]) {
  assert(concerts.some((concert) => concert.id === id), id);
}
assert(concerts.filter((concert) => concert.notes === "audio-only").length >= 4, "audio notes");
assert(concerts.some((concert) => concert.notes === "partial"), "partial note");
const audio = concerts.find((concert) => concert.id === "btIIPIPDO4U");
const partial = concerts.find((concert) => concert.id === "4fPKcqx87Yc");
assert(audio.notes === "audio-only" && partial.notes === "partial");
assert(JSON.stringify(musicians["Jaco Pastorius"]) === JSON.stringify(["bass"]));
assert(JSON.stringify(musicians["John McLaughlin"]) === JSON.stringify(["guitar"]));
assert(JSON.stringify(musicians["Chad Smith"]) === JSON.stringify(["drums"]));
assert(JSON.stringify(musicians["Prince"]) === JSON.stringify(["guitar", "vocals", "keyboards"]));

assert(Catalog.formatDuration(0) === "0:00:00");
assert(Catalog.formatDuration(61) === "0:01:01");
assert(Catalog.formatDuration(7474) === "2:04:34");
assert(Catalog.decadeOf(0) === "Unknown");
assert(Catalog.decadeOf(1969) === "1960s");
assert(Catalog.decadeOf(1978) === "1970s");
assert(Catalog.decadeOf(2008) === "2000s");
assert(Catalog.pageCount(0) === 1);
assert(Catalog.pageCount(12) === 1);
assert(Catalog.pageCount(13) === 2);
assert(Catalog.PER_PAGE === 12);

const index = Catalog.buildIndex(concerts, musicians);
const genreList = [...new Set(concerts.map((concert) => concert.genre))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
assert(JSON.stringify(index.genres) === JSON.stringify(genreList), "genres come from the data");
const requiredGenres = ["Afrobeat", "Bluegrass", "Blues", "Chamber Music", "Classic Rock", "Country", "EDM", "Experimental", "Flamenco", "Folk", "Funk", "Fusion", "Gamelan", "Gospel", "House", "Indian Classical", "Jazz", "K-pop", "Latin/Salsa", "Manchester/Madchester", "Metal", "Orchestral", "Progressive Rock", "Punk", "Rap/Hip-Hop", "Reggae", "Rockabilly", "Soul/R&B", "Taiko"];
for (const genre of requiredGenres) assert(index.genres.includes(genre), genre);
assert(index.instruments.includes("DJ") && index.instruments.includes("sarod") && index.instruments.includes("taiko") && index.instruments.includes("gamelan"));
assert(index.decades.at(-1) === "Unknown");
assert(index.instruments.includes("bass"));
assert(index.instruments.includes("tabla"));
assert(!index.instruments.includes("Bass"));

const rockpalast = concerts.find((concert) => concert.id === "0wtqnKXZlWk");
assert(rockpalast.artist === "Weather Report");
assert(rockpalast.musicians.includes("Jaco Pastorius"));
assert(Catalog.formatDuration(rockpalast.durationSeconds) === "2:04:34");

const rows = Catalog.sortConcerts(concerts, "artist");
for (let i = 1; i < rows.length; i += 1) {
  const order = rows[i - 1].artist.localeCompare(rows[i].artist, undefined, { sensitivity: "base" });
  assert(order <= 0, "artist sort");
}
const byTime = Catalog.sortConcerts(concerts, "time");
assert(byTime[0].durationSeconds >= byTime[1].durationSeconds);
const byYear = Catalog.sortConcerts(concerts, "year");
assert((byYear[0].year || 9999) <= (byYear[1].year || 9999));
assert(byYear.at(-1).year === 0, "unknown years sort last");

const groups = Catalog.groupConcerts(rows, "artist", "artist", { index, musician: "All", query: "" });
for (let i = 1; i < groups.length; i += 1) {
  assert(groups[i - 1].key.localeCompare(groups[i].key, undefined, { sensitivity: "base" }) <= 0, "group order");
}
const weather = groups.find((group) => group.key === "Weather Report");
assert(weather && weather.shows >= 4);
for (const id of ["0wtqnKXZlWk", "LfvfXA2SIRU", "M8vdVo_HsMM", "lfDRSccNYRc"]) {
  assert(weather.items.some((concert) => concert.id === id), id);
}

const musicianGroups = Catalog.groupConcerts(rows, "musician", "artist", { index, musician: "All", query: "" });
assert(musicianGroups.every((group) => index.musicianCount[group.key] > 1 || group.shows > 1));
const solo = index.musicianNames.find((name) => index.musicianCount[name] === 1);
assert(solo, "a one-show musician");
assert(!musicianGroups.some((group) => group.key === solo));
const soloRows = Catalog.sortConcerts(concerts.filter((concert) => Catalog.matches(concert, { query: solo }, index)), "artist");
const soloGroups = Catalog.groupConcerts(soloRows, "musician", "artist", { index, musician: "All", query: solo });
assert(soloGroups.some((group) => group.key === solo), "search reveals one-show musicians");

const off = concerts.filter((concert) => Catalog.matches(concert, { query: "Offenbach" }, index));
assert(off.some((concert) => concert.id === "0wtqnKXZlWk"));
const sixties = concerts.filter((concert) => Catalog.matches(concert, { decade: "1960s" }, index));
assert(sixties.length > 0 && sixties.every((concert) => Catalog.decadeOf(concert.year) === "1960s"));
const unknown = concerts.filter((concert) => Catalog.matches(concert, { decade: "Unknown" }, index));
assert(unknown.length > 0 && unknown.every((concert) => concert.year === 0));

const bassRows = concerts.filter((concert) => Catalog.matches(concert, { instrument: "bass" }, index));
assert(bassRows.length > 0);
assert(bassRows.every((concert) => concert.musicians.some((name) => (musicians[name] || []).includes("bass"))));
assert(bassRows.some((concert) => concert.id === "0wtqnKXZlWk"));
const vocalRows = concerts.filter((concert) => Catalog.matches(concert, { instrument: "vocals" }, index));
const nonVocal = concerts.find((concert) => concert.musicians.some((name) => musicians[name]) && !concert.musicians.some((name) => (musicians[name] || []).includes("vocals")));
assert(nonVocal && !vocalRows.some((concert) => concert.id === nonVocal.id));

const instrumentGroups = Catalog.groupConcerts(rows, "instrument", "artist", { index, musician: "All", query: "" });
const uncredited = concerts.filter((concert) => concert.musicians.every((name) => !musicians[name]));
assert(uncredited.length >= 1);
for (const concert of uncredited) {
  assert(!instrumentGroups.some((group) => group.items.some((item) => item.id === concert.id)), concert.artist);
}
const prince = concerts.find((concert) => concert.id === "4fPKcqx87Yc");
const princeGroups = Catalog.groupConcerts([prince], "instrument", "artist", { index, musician: "All", query: "" });
for (const instrument of musicians.Prince) {
  assert(princeGroups.some((group) => group.key === instrument), instrument);
}

const joni = concerts.find((concert) => concert.id === "5XB7iPsCjC4");
const related = Catalog.related(joni, concerts, 40);
const metheny = related.find((item) => item.concert.id === "jvmxYM4dTik");
assert(metheny && metheny.shared.includes("Pat Metheny") && metheny.shared.includes("Lyle Mays"));
for (let i = 1; i < related.length; i += 1) {
  assert(related[i - 1].shared.length >= related[i].shared.length, "related order");
}
assert(Catalog.related(joni, concerts, 5).length === 5);

const extraConcerts = concerts.concat([{
  id: "AAAAAAAAAAA",
  artist: "New Player",
  title: "Night zydeco",
  year: 2024,
  genre: "Zydeco",
  musicians: ["New Player"],
  durationSeconds: 90,
}]);
const extraIndex = Catalog.buildIndex(extraConcerts, { ...musicians, "New Player": ["sitar"] });
assert(extraIndex.genres.includes("Zydeco"));
assert(extraIndex.instruments.includes("sitar"));
assert(extraConcerts.some((concert) => Catalog.matches(concert, { genre: "Zydeco", instrument: "sitar" }, extraIndex)));

for (const file of ["index.html", "embed-demo.html", "css/styles.css", "js/app.js", "js/view.js", "js/catalog.js", "js/embed-boot.js"]) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  if (/(?:href|src|url\()\s*["']?\//.test(text)) throw new Error(file + " has a root-absolute path");
}
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
for (const ref of ["css/styles.css", "js/catalog.js", "js/view.js", "js/app.js", "favicon.svg", "data/concerts.json"]) {
  const bundle = ref.endsWith(".json") ? fs.readFileSync(path.join(root, "js/app.js"), "utf8") : html;
  assert(bundle.includes(ref), "missing " + ref);
}
const workflow = fs.readFileSync(path.join(root, ".github/workflows/pages.yml"), "utf8");
for (const name of ["actions/configure-pages", "actions/upload-pages-artifact", "actions/deploy-pages", "scripts/validate-data.js", "scripts/build-catalog.js", "scripts/build-embed.js", "embed-demo.html", "workflow_dispatch", "needs: build"]) {
  assert(workflow.includes(name), name);
}
const deployJob = workflow.split(/\n {2}deploy:\n/)[1] || "";
assert(deployJob.length > 0, "deploy job");
assert(!deployJob.includes("actions/upload-pages-artifact"), "deploy job only deploys");
assert(deployJob.includes("pages: write") && deployJob.includes("id-token: write"), "deploy permissions");

assert(concerts.every((concert) => concert.type === "concert" || concert.type === "interview"), "every item has a type");
assert(concerts.filter((concert) => concert.type === "concert").length === 1390, "concert count");
assert(concerts.filter((concert) => concert.type === "interview").length === 736, "interview count");
assert(Catalog.itemType({}) === "concert", "missing type is concert");
assert(Catalog.TYPES.map((type) => type.id).join() === "concert,interview");
const interview = {
  id: "bbbbbbbbbbb",
  type: "interview",
  artist: "Pat Metheny",
  title: "Pat Metheny interview",
  year: 1991,
  genre: "Jazz",
  musicians: ["Pat Metheny", "Terry Gross"],
  credits: [{ name: "Pat Metheny", role: "interviewee" }, { name: "Terry Gross", role: "interviewer" }],
  interviewer: "Terry Gross",
  outlet: "Fresh Air",
  durationSeconds: 1800,
};
const typed = concerts.concat([interview]);
const typedIndex = Catalog.buildIndex(typed, musicians);
assert(Catalog.matches(interview, { type: "interview" }, typedIndex));
assert(!Catalog.matches(concerts[0], { type: "interview" }, typedIndex));
assert(Catalog.matches(concerts[0], { type: "concert" }, typedIndex));
assert(Catalog.matches(interview, { musician: "Pat Metheny" }, typedIndex));
assert(Catalog.matches(interview, { instrument: "guitar" }, typedIndex), "interview matches a lineup instrument");
const hostOnly = Object.assign({}, interview, {
  id: "ccccccccccc",
  musicians: ["Terry Gross"],
  credits: [{ name: "Terry Gross", role: "interviewer" }],
});
assert(!Catalog.matches(hostOnly, { instrument: "guitar" }, Catalog.buildIndex(typed.concat([hostOnly]), musicians)));
const patGroups = Catalog.groupConcerts(
  Catalog.sortConcerts(typed.filter((item) => Catalog.lineup(item).some((entry) => entry.name === "Pat Metheny")), "artist"),
  "musician",
  "artist",
  { index: typedIndex, musician: "Pat Metheny", query: "" }
);
const pat = patGroups.find((group) => group.key === "Pat Metheny");
assert(pat && pat.items.some((item) => Catalog.itemType(item) === "interview") && pat.items.some((item) => Catalog.itemType(item) === "concert"));
const bare = Object.assign({}, concerts[0], { id: "ddddddddddd" });
delete bare.type;
assert(validate([bare], musicians).some((error) => error.includes("type")), "type is required");
assert(validate([Object.assign({}, bare, { type: "lesson" })], musicians).length === 0, "a new lowercase type is allowed");
assert(validate([Object.assign({}, bare, { type: "concert", outlet: " " })], musicians).some((error) => error.includes("outlet")));
assert(validate([interview], musicians).length === 0, "interview validates");
assert(validate([Object.assign({}, interview, { interviewer: " " })], musicians).some((error) => error.includes("interviewer")));
assert(validate([Object.assign({}, interview, { musicians: [{ name: "Pat Metheny" }] })], musicians).some((error) => error.includes("string")), "musicians stay strings");
const zappaItems = Catalog.sortConcerts(concerts.filter((item) => item.artist === "Frank Zappa"), "year");
const zappaGroups = Catalog.groupConcerts(zappaItems, "artist", "year", { index, musician: "All", query: "" });
const zappa = zappaGroups.find((group) => group.key === "Frank Zappa");
assert(zappa && zappa.items.some((item) => item.type === "concert") && zappa.items.filter((item) => item.type === "interview").length === 91, "artist page mixes both types");
assert(zappa.items.map((item) => item.id).join("|") === Catalog.sortConcerts(zappa.items, "year").map((item) => item.id).join("|"), "artist page is one sorted list");
const zappaConcertsOnly = Catalog.groupConcerts(
  Catalog.sortConcerts(concerts.filter((item) => item.artist === "Frank Zappa" && Catalog.matches(item, { type: "concert" }, index)), "year"),
  "artist",
  "year",
  { index, musician: "All", query: "" }
).find((group) => group.key === "Frank Zappa");
assert(zappaConcertsOnly && zappaConcertsOnly.items.every((item) => item.type === "concert") && !zappaConcertsOnly.items.some((item) => item.type === "interview"), "type filter hides interviews");
const belewHits = concerts.filter((item) => Catalog.matches(item, { query: "adrian belew" }, index));
const belewActs = new Set(belewHits.map((item) => item.artist));
for (const act of ["Frank Zappa", "King Crimson", "Talking Heads", "Adrian Belew"]) {
  assert(belewActs.has(act), "adrian belew search includes " + act);
}
const belewGroups = Catalog.groupConcerts(Catalog.sortConcerts(belewHits, "artist"), "artist", "artist", { index, musician: "All", query: "adrian belew" });
assert(belewGroups.some((group) => group.key === "King Crimson") && belewGroups.some((group) => group.key === "Frank Zappa"), "belew results group by artist");
const belewConcerts = concerts.filter((item) => Catalog.matches(item, { query: "adrian belew", type: "concert" }, index));
assert(belewConcerts.length > 0 && belewConcerts.every((item) => item.type === "concert"), "type filter still applies to search");
const accented = Object.assign({}, concerts[0], { id: "eeeeeeeeeee", artist: "José González", musicians: ["José González"] });
assert(Catalog.matches(accented, { query: "jose gonzalez" }, Catalog.buildIndex([accented], {})));
const creditOnly = Object.assign({}, concerts[0], {
  id: "ffffffffffff",
  artist: "Some Band",
  title: "A talk",
  musicians: ["Host Person"],
  credits: [{ name: "Hidden Guest", role: "interviewer" }],
});
assert(Catalog.matches(creditOnly, { query: "hidden guest" }, Catalog.buildIndex([creditOnly], {})), "search matches credits names");
const belewNotes = Catalog.appearances("adrian belew", belewHits);
assert(belewNotes.some((person) => person.name === "Adrian Belew" && person.acts.includes("King Crimson") && person.acts.includes("Talking Heads")));
assert(concerts.some((concert) => concert.year === 0), "unknown years stay in the data");
assert(!fs.readFileSync(path.join(root, "js/app.js"), "utf8").includes("Year unknown"), "unknown years render blank");
function parseCsv(text) {
  assert(text.charCodeAt(0) === 0xFEFF, "csv starts with a UTF-8 BOM");
  const body = text.slice(1);
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      if (field.endsWith("\r")) field = field.slice(0, -1);
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    if (field.endsWith("\r")) field = field.slice(0, -1);
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.length > 1 || cells[0] !== "");
}

const tricky = {
  id: "zzzzzzzzzzz",
  type: "interview",
  artist: 'José "Pepe" González',
  title: "Hello, world",
  year: 0,
  genre: "Folk, early",
  musicians: ["José González", "Ada, Lovelace"],
  credits: [
    { name: "José González", role: "interviewee" },
    { name: "Ada, Lovelace", role: "interviewer" },
  ],
  interviewer: "Ada, Lovelace",
  outlet: "Night\nFlight",
  durationSeconds: 61,
};
const trickyIndex = Catalog.buildIndex([tricky], { "José González": ["guitar", "vocals"] });
const trickyRows = parseCsv(Catalog.toCsv([tricky], trickyIndex));
assert(trickyRows.length === 2, "header plus one row");
assert(trickyRows[0].join(",") === Catalog.CSV_HEADERS.join(","), "csv header");
const trickyRow = trickyRows[1];
assert(trickyRow[0] === "interview");
assert(trickyRow[1] === 'José "Pepe" González');
assert(trickyRow[2] === "Hello, world");
assert(trickyRow[3] === "", "unknown year is blank");
assert(trickyRow[4] === "Folk, early");
assert(trickyRow[5] === "61");
assert(trickyRow[6] === "0:01:01");
assert(trickyRow[7] === "Guitar; Vocals", "featured instruments");
assert(trickyRow[8] === "José González; Ada, Lovelace");
assert(trickyRow[9] === "Ada, Lovelace");
assert(trickyRow[10] === "Night\nFlight");
assert(trickyRow[11] === "José González (interviewee); Ada, Lovelace (interviewer)");
assert(trickyRow[12] === "https://www.youtube.com/watch?v=zzzzzzzzzzz");
assert(trickyRow[13] === "https://ytmusictrainer.com/?video_id=zzzzzzzzzzz");
assert(trickyRow[14] === "zzzzzzzzzzz");
assert(Catalog.toCsv([tricky], trickyIndex).includes('"José ""Pepe"" González"'), "quotes are doubled");

const sample = concerts.find((item) => item.id === "0wtqnKXZlWk");
const sampleRow = parseCsv(Catalog.toCsv([sample], index))[1];
assert(sampleRow[1] === sample.artist && sampleRow[8] === sample.musicians.join("; "));
assert(sampleRow[7].split("; ").includes("Bass"), "Jaco's bass is a featured instrument");
assert(sampleRow[6] === Catalog.formatDuration(sample.durationSeconds));
assert(sampleRow[12] === "https://www.youtube.com/watch?v=" + sample.id);
assert(sampleRow[13] === Catalog.trainerUrl(sample.id));
assert(Catalog.YT_TRAINER_BASE === "https://ytmusictrainer.com/?video_id=");
assert(Catalog.trainerUrl("HW9qLOfHabI") === "https://ytmusictrainer.com/?video_id=HW9qLOfHabI");
assert(Catalog.artistSlug("Frank Zappa") === "frank-zappa");
assert(Catalog.artistSlug("José González") === "jose-gonzalez");
const zappaConcert = concerts.find((item) => item.artist === "Frank Zappa");
const otherAct = concerts.find((item) => item.artist === "Weather Report");
assert(Catalog.matches(zappaConcert, { artist: "frank-zappa" }, index));
assert(!Catalog.matches(otherAct, { artist: "frank-zappa" }, index));

const interviewItems = Catalog.sortConcerts(concerts.filter((item) => Catalog.matches(item, { type: "interview" }, index)), "year");
const interviewSheet = parseCsv(Catalog.toCsv(interviewItems, index));
assert(interviewSheet.length === interviewItems.length + 1, "filtered csv is one row per interview");
assert(interviewSheet.slice(1).every((row) => row[0] === "interview"));
const talk = interviewItems.find((item) => item.credits && item.interviewer && item.outlet);
assert(talk, "an interview with credits");
const talkRow = parseCsv(Catalog.toCsv([talk], index))[1];
assert(talkRow[9] === talk.interviewer && talkRow[10] === talk.outlet);
assert(talkRow[11] === talk.credits.map((credit) => credit.name + " (" + credit.role + ")").join("; "));

const belewSheet = parseCsv(Catalog.toCsv(Catalog.sortConcerts(belewHits, "artist"), index));
const belewArtists = new Set(belewSheet.slice(1).map((row) => row[1]));
for (const act of ["Frank Zappa", "King Crimson", "Talking Heads"]) {
  assert(belewArtists.has(act), "csv search export includes " + act);
}
assert(belewSheet.length === belewHits.length + 1, "search export is one row per video");

const fullSheet = parseCsv(Catalog.toCsv(Catalog.sortConcerts(concerts, "artist"), index));
assert(fullSheet.length === concerts.length + 1, "unfiltered csv is the whole catalog");
assert(fullSheet[1][1] === Catalog.sortConcerts(concerts, "artist")[0].artist);

const exported = path.join(os.tmpdir(), "lcf-catalog-" + process.pid + ".csv");
const exportRun = spawnSync(process.execPath, [path.join(root, "scripts", "export-csv.js"), exported], { encoding: "utf8" });
assert(exportRun.status === 0, exportRun.stderr || "export-csv failed");
const exportedText = fs.readFileSync(exported, "utf8");
assert(exportedText === Catalog.toCsv(Catalog.sortConcerts(concerts, "artist"), index), "export script matches the catalog csv");
fs.unlinkSync(exported);

assert(html.includes("Download this list") && html.includes("Download full spreadsheet") && html.includes("data/catalog.csv"), "spreadsheet links");
const viewSource = fs.readFileSync(path.join(root, "js", "view.js"), "utf8");
assert(viewSource.includes("View on YouTube") && viewSource.includes("Open on YT Trainer"), "video links");
assert(viewSource.includes("Catalog.trainerUrl") && !viewSource.includes("ytmusictrainer.com"), "trainer url stays in catalog.js");
assert(viewSource.includes("youtube-nocookie.com/embed/"), "inline player");
assert(viewSource.includes('data-action="csv"'), "embed shell has the csv button");
const demo = fs.readFileSync(path.join(root, "embed-demo.html"), "utf8");
assert(demo.includes('<div id="concert-finder"></div>') || demo.includes("&lt;div id=\"concert-finder\"&gt;&lt;/div&gt;"), "demo snippet");
assert(demo.includes("https://mkpworks.github.io/live-concert-finder/embed.js") && demo.includes("defer"), "demo script url");
assert(demo.includes('src="embed.js"'), "demo runs the local embed");
const boot = fs.readFileSync(path.join(root, "js", "embed-boot.js"), "utf8");
assert(boot.includes("document.currentScript") && boot.includes("data/version.json") && boot.includes("data/catalog.json"), "embed resolves data from its own src");
assert(boot.includes("attachShadow") && boot.includes("[data-concert-finder]") && boot.includes("window.ConcertFinder"), "embed contract");
assert(boot.includes('cache: "no-store"'), "version fetch bypasses the pages cache");
global.Catalog = Catalog;
const FinderView = require("../js/view.js");
assert(FinderView.typeOption("concerts") === "concert" && FinderView.typeOption("interviews") === "interview" && FinderView.typeOption("all") === "All");
const rollinsHits = concerts.filter((item) => Catalog.matches(item, { query: "Henry Rollins" }, index));
assert(rollinsHits.some((item) => item.artist === "Black Flag"), "Henry Rollins is on a Black Flag item");
const rollinsSearch = FinderView.clearedFilters(index, {
  genre: "Metal",
  decade: "All",
  musician: "All",
  instrument: "All",
  type: "interview",
  artist: "black-flag",
}, "Henry Rollins");
assert(rollinsSearch.query === "Henry Rollins");
assert(rollinsSearch.genre === "All", "a genre with no Rollins item is cleared");
assert(rollinsSearch.type === "All", "a type with no Rollins item is cleared");
assert(rollinsHits.some((item) => item.artist === "Henry Rollins" && item.type === "concert" && item.genre === "Punk" && /spoken-word/i.test(item.notes || "")), "spoken-word shows stay Punk concerts");
assert(rollinsSearch.artist === "", "the Black Flag filter hides his other shows");
const belewNameHits = concerts.filter((item) => Catalog.matches(item, { query: "Adrian Belew" }, index));
const belewNameActs = new Set(belewNameHits.map((item) => item.artist));
assert(belewNameActs.size > 1, "Adrian Belew crosses acts");
const belewSearch = FinderView.clearedFilters(index, {
  genre: "All",
  decade: "All",
  musician: "All",
  instrument: "All",
  type: "All",
  artist: "black-flag",
}, "Adrian Belew");
assert(belewSearch.query === "Adrian Belew" && belewSearch.artist === "", "an artist filter that hides other acts is cleared");
assert(viewSource.includes('class="name-link"') || viewSource.includes('searchButton(concert.artist, "name-link")'));
assert(viewSource.includes('data-action="search"') && viewSource.includes("runSearch"));
const shell = FinderView.shellHtml();
assert(shell.includes("Powered by") && shell.includes("Download this list") && shell.includes('id="results"'));

const built = path.join(os.tmpdir(), "lcf-embed-" + process.pid);
fs.mkdirSync(built, { recursive: true });
const catalogBuild = spawnSync(process.execPath, [path.join(root, "scripts", "build-catalog.js"), built], { encoding: "utf8" });
assert(catalogBuild.status === 0, catalogBuild.stderr || "build-catalog failed");
const versionFile = JSON.parse(fs.readFileSync(path.join(built, "version.json"), "utf8"));
const catalogFile = JSON.parse(fs.readFileSync(path.join(built, "catalog.json"), "utf8"));
assert(versionFile.version === "1" && catalogFile.version === "1", "schema version 1");
assert(versionFile.generated_at === catalogFile.generated_at && /^\d{4}-\d{2}-\d{2}T/.test(versionFile.generated_at), "generated_at");
assert(catalogFile.concerts.length === concerts.length, "catalog.json concerts");
assert(JSON.stringify(catalogFile.musicians["Jaco Pastorius"]) === JSON.stringify(["bass"]), "catalog.json musicians");
const embedOut = path.join(built, "embed.js");
const embedBuild = spawnSync(process.execPath, [path.join(root, "scripts", "build-embed.js"), embedOut], { encoding: "utf8" });
assert(embedBuild.status === 0, embedBuild.stderr || "build-embed failed");
const embedCheck = spawnSync(process.execPath, ["--check", embedOut], { encoding: "utf8" });
assert(embedCheck.status === 0, embedCheck.stderr || "embed.js syntax");
const embedSource = fs.readFileSync(embedOut, "utf8");
for (const needle of ["window.ConcertFinder", "attachShadow", "[data-concert-finder]", "data/version.json", "data/catalog.json", "Open on YT Trainer", "youtube-nocookie.com/embed/", "Powered by"]) {
  assert(embedSource.includes(needle), "embed bundle missing " + needle);
}
assert(workflow.includes("scripts/export-csv.js") && workflow.includes("_site/data/catalog.csv"), "pages build publishes the csv");

const started = process.hrtime.bigint();
for (let pass = 0; pass < 100; pass += 1) {
  const filtered = Catalog.sortConcerts(
    concerts.filter((concert) => Catalog.matches(concert, { query: "king", instrument: pass % 2 ? "guitar" : "All", genre: pass % 5 ? "All" : "Metal" }, index)),
    "artist"
  );
  Catalog.groupConcerts(filtered, "musician", "artist", { index, musician: "All", query: "king" });
  Catalog.groupConcerts(filtered, "instrument", "time", { index, musician: "All", query: "" });
}
const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
assert(elapsed < 1500, "filtering the catalog 100 times took " + elapsed.toFixed(0) + "ms");
console.log("OK: catalog checks passed (" + concerts.length + " concerts, " + index.genres.length + " genres, " + index.instruments.length + " instruments, filter pass " + elapsed.toFixed(0) + "ms)");
