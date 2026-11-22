# Live Concert Finder data schema (v5)

This folder is a drop-in evolution of `concerts.json` and `musicians.json`. The filename `concerts.json` is kept so existing tooling can keep pointing at it; the file is now a catalog of **media items**, not only concerts. Every item has a `type`. The site should branch on `type` rather than assuming every row is a concert.

## Files

- `concerts.json` — array of item objects (concerts, interviews, and future types).
- `musicians.json` — map of person name → non-empty array of instrument names. Interviewees (and other credited musicians) should be listed here so a musician page can show that person's concerts **and** interviews (and, later, lessons). Interviewers who are not catalogued musicians may appear in an item's `musicians` / `credits` without an entry here.

## Item fields

Required on every item:

| Field | Meaning |
| --- | --- |
| `id` | 11-character YouTube video id. Unique across the whole catalog, all types. |
| `type` | Content category. Current values: `"concert"`, `"interview"`. Add new categories by introducing a new `type` string (see below). |
| `artist` | Primary billing. For a concert, the act. For an interview, the main subject. For a future lesson, the teacher or featured player. |
| `title` | Video title (as given by the source; do not invent). |
| `year` | Performance or recording year. `0` if it is not stated in the title or description. Never infer a year from the YouTube upload date. |
| `genre` | A catalog genre string (same vocabulary as concerts). For interviews (and future lessons), use the main subject's primary catalog genre so existing genre filters still work. Do **not** add a genre called "Interview" or "Lesson"; `type` already distinguishes the category. |
| `musicians` | Non-empty array of unique credited **names** (strings). This is the field used to link an item to `musicians.json` and to a musician page. |
| `durationSeconds` | Real running time in seconds (from YouTube length, never guessed). Must be a positive integer. |

Optional on any item:

| Field | Meaning |
| --- | --- |
| `notes` | Non-empty string with curator notes (source caveats, trim vs complete, etc.). |
| `credits` | Array of `{ "name", "role" }` objects describing how each person appears. Names in `credits` should also appear in `musicians`. Roles are lowercase words; they are not limited to a closed enum, but keep them stable. |

Optional on **interviews** (omit when unknown; do not guess):

| Field | Meaning |
| --- | --- |
| `interviewer` | Interviewer name(s). One name, or a comma-separated list when several hosts are known. Also list each person in `musicians` and in `credits` with `"role": "interviewer"`. |
| `outlet` | TV show, station, or publication, e.g. `"Late Night with David Letterman"`, `"MTV"`, `"Crossfire"`, `"Night Flight"`. |

### `type: "concert"`

`musicians` is the performance lineup (well-known names only). `credits` may be omitted; if present, typical roles are `"performer"` (or more specific roles later). Concerts in this folder do not yet include `credits`.

### `type: "interview"`

- `artist` is the main subject (the person the interview is filed under).
- `musicians` lists people featured: the interviewee(s) first, then interviewer(s) when known.
- `credits` should mark each name with `"interviewee"` or `"interviewer"`.
- Other guests who speak at length can be added as interviewees (or a more specific role) when they are clearly identified.

## Adding a future type (e.g. `"lesson"`)

1. Pick a short lowercase `type` token (`lesson`, or `lesson-in-the-style-of` if you need a hyphenated subtype). Do **not** overload `genre` or invent a parallel catalog file.
2. Reuse the required fields above. Set `artist` to the teacher or featured player, `year` / `durationSeconds` / `id` / `title` as usual, and `genre` to that person's primary catalog genre.
3. Put every person who should appear on a musician page in `musicians`, and spell out roles in `credits` (e.g. `"instructor"`, `"student"`, `"demonstrator"`).
4. Add optional type-specific fields as needed (for a lesson, perhaps `topic` or `styleOf`), but keep them optional and omit them when unknown. The current repo validator ignores unknown fields; extend it to check new required fields when you add the type to the site.
5. Only add verified YouTube ids (oEmbed 200), real durations, and years taken from the title or description (`0` if unknown). Dedupe by video id and by the same appearance.

Items of different types may share an `artist` and should share musician names exactly as they appear in `musicians.json` (e.g. `"Frank Zappa"`), so one person page can list all of their catalog items.

## Validation

`validate-data.js` in this folder requires `type` and checks interview-only fields when present. The repo copy at `scripts/validate-data.js` (as of v4) does **not** yet know about `type`, but it still **passes** this data: it ignores unknown fields, and `musicians` remains a string array. Merge the type checks from this folder's script into the repo validator when the site starts using `type`.
