# Live Concert Finder

A static catalog of concerts, interviews, and other long-form sets on YouTube. Items can be searched and grouped by artist, musician, or instrument. Search matches the artist, title, lineup names, interview credit names, interviewer, and outlet, ignoring case and accents. People who show up more than once are linked across the list.

Published with GitHub Pages at <https://mkpworks.github.io/live-concert-finder/>.

## Preview locally

From the repository root:

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000/>. The page loads JSON with `fetch`, so opening `index.html` directly from disk will not work.

## Add a concert

Append an object to `data/concerts.json`:

```json
{
  "id": "youtubeVideoId",
  "artist": "Artist or group",
  "title": "Show title",
  "year": 1978,
  "genre": "Country",
  "musicians": ["Player One", "Player Two"],
  "durationSeconds": 3600
}
```

- `id` is the 11-character YouTube id (the `v=` value). It has to be unique.
- `year` is `0` when the year is unknown. Decade filters are built from the years in the file.
- `genre` is plain text. A new value such as Country, Metal, or Reggae shows up in the genre filter on its own. Nothing in the page hardcodes the genre list.
- `musicians` is the lineup, in the order it should be shown. Spell a name the same way everywhere, including in `data/musicians.json`.
- `durationSeconds` is the length of the YouTube video.
- Optional `notes` is a short string. Use `"audio-only"` or `"partial"` when that applies. The page labels those two, and shows any other note as written.
- `type` is required. Current values are `"concert"` and `"interview"`. Labels for the Type filter live in `TYPES` inside `js/catalog.js`. Adding a category such as lessons is one new object there. The data check accepts any short lowercase type token, so the file can gain a type before the filter lists it. If `type` is missing at runtime, the page treats the item as a concert. See `SCHEMA.md` for the full field list.

An interview uses the same core fields. `artist` is the main subject. `musicians` stays a list of names. Optional `credits` is `[{ "name", "role" }]`, with roles such as `"interviewee"` and `"interviewer"`. Optional `interviewer` and `outlet` are strings. On an artist or musician page, concerts and interviews stay in one list unless the Type filter hides one of them.

```json
{
  "id": "youtubeVideoId",
  "type": "interview",
  "artist": "Frank Zappa",
  "title": "Frank Zappa on Crossfire 1986",
  "year": 1986,
  "genre": "Classic Rock",
  "musicians": ["Frank Zappa", "Robert Novak", "Tom Braden"],
  "credits": [
    { "name": "Frank Zappa", "role": "interviewee" },
    { "name": "Robert Novak", "role": "interviewer" },
    { "name": "Tom Braden", "role": "interviewer" }
  ],
  "interviewer": "Robert Novak, Tom Braden",
  "outlet": "Crossfire",
  "durationSeconds": 1278
}
```

## Add instruments

`data/musicians.json` maps a musician's name to the instruments they are known for:

```json
{
  "Jaco Pastorius": ["bass"],
  "John McLaughlin": ["guitar"],
  "Chad Smith": ["drums"],
  "Prince": ["guitar", "vocals", "keyboards"]
}
```

Most people have one instrument. Use a list when more than one role is well known, and put the main one first. Leave a person out when you are not sure. Names that are not on a concert yet are fine. A later, fuller table can replace this file without a code change.

The instrument filter and the "By instrument" view are built from this file. They only list instruments played by someone on a lineup. An interview matches an instrument only when one of its lineup names has that instrument here. A credit that only names the band, or a person with no entry, is left out of that view and still appears under the artist and in All items.

## Spreadsheet

**Download this list**, in the toolbar, saves the videos that match the current type, search, genre, decade, musician, and instrument filters. The rows follow the current sort, one video per row. With the filters cleared, that file is the whole catalog.

The Pages build also writes `data/catalog.csv`, the full catalog in artist order, as UTF-8 with a byte-order mark so Excel keeps accents. The footer link **Download full spreadsheet** points at that file. To write the same file locally:

```bash
node scripts/export-csv.js
```

The local copy is gitignored. The site build publishes its own. Columns are type, artist, title, year (blank when unknown), genre, duration in seconds and as `h:mm:ss`, featured instruments on file for the lineup (joined with `; `, blank when none are listed), musicians joined with `; `, interviewer, outlet, credits as `name (role)` joined with `; `, the YouTube URL, and the video id.

## Check the data

```bash
node scripts/validate-data.js
node scripts/check-catalog.js
```

Validation requires unique YouTube ids and the required concert fields, and it checks that each instrument list is a non-empty list of names. It prints musicians who still have no instruments. That reminder is not a failure. The Pages workflow runs the same checks before it deploys.

## Deploy

Pushes to `main` run `.github/workflows/pages.yml`, which checks the data and deploys with `actions/configure-pages`, `actions/upload-pages-artifact`, and `actions/deploy-pages`.

The repository owner has to set **Settings → Pages → Build and deployment → Source** to **GitHub Actions** before the first deploy can succeed.
