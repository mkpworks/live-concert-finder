# Live Concert Finder

A static catalog of full concerts and long live sets on YouTube. Shows can be searched and grouped by artist, musician, or instrument. Players who show up with more than one band are linked across the list.

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

The instrument filter and the "By instrument" view are built from this file. They only list instruments played by someone who appears on a concert. A lineup that only names the band, or a player with no entry here, is left out of that view and still appears under the artist and in All concerts.

## Check the data

```bash
node scripts/validate-data.js
node scripts/check-catalog.js
```

Validation requires unique YouTube ids and the required concert fields, and it checks that each instrument list is a non-empty list of lowercase names. It prints musicians who still have no instruments. That reminder is not a failure. The Pages workflow runs the same checks before it deploys.

## Deploy

Pushes to `main` run `.github/workflows/pages.yml`, which checks the data and deploys with `actions/configure-pages`, `actions/upload-pages-artifact`, and `actions/deploy-pages`.

The repository owner has to set **Settings → Pages → Build and deployment → Source** to **GitHub Actions** before the first deploy can succeed.
