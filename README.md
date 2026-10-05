# GATE ECE Chapter-Wise Test Series Platform

## Render deployment (complete app)

The React frontend and Express API run together on one HTTPS origin. This
preserves the secure cookie login and protected question images.

### Before deployment

- Older Git history contains database credentials. Rotate that database user's
  password in your MongoDB provider and update your local `server/.env` and
  Render secrets. Removing `.env` from the latest commit does not revoke old
  credentials. Use a newly generated JWT secret for this deployment.
- Use Node.js 24.19.0, pinned in `.node-version`.
- Allow your Render service's outbound IP ranges in MongoDB's network access
  settings and use a TLS connection (`mongodb+srv://...`).

### Create the Render service

Use **New > Blueprint**, connect this GitHub repository, and select branch
`phase-5/student-frontend`. The root `render.yaml` configures the full app.
Enter `MONGO_URI` and `JWT_SECRET` in Render's secret fields. Generate the JWT
secret locally with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`.
Keep the output private; do not commit it.

If creating a Web Service manually, use these settings:

| Setting | Value |
| --- | --- |
| Branch | `phase-5/student-frontend` |
| Root directory | Leave blank (repository root) |
| Runtime | Node |
| Build command | `npm ci --prefix server --omit=dev && npm ci --prefix client --include=dev && npm run build --prefix client` |
| Start command | `npm start --prefix server` |
| Health check path | `/health` |
| Environment | `NODE_ENV=production`, `TRUST_PROXY=1`, `VITE_API_URL=/api`, plus `MONGO_URI` and `JWT_SECRET` |

Render supplies `PORT` and `RENDER_EXTERNAL_URL`. Without an explicit
`CLIENT_ORIGIN`, the server allows the Render URL. The frontend build also uses
the Render URL for canonical metadata, `robots.txt`, and `sitemap.xml`.
For a custom domain, set `CLIENT_ORIGIN=https://your-domain` and
`VITE_SITE_URL=https://your-domain`, without trailing slashes, then rebuild.
If serving both domains, put both exact HTTPS origins in `CLIENT_ORIGIN`,
comma-separated. Keep `VITE_API_URL=/api`.

### Database and media

The production server creates declared database indexes before accepting
requests. If duplicate emails or duplicate active attempts prevent unique
indexes, resolve those records before deploying; startup stops instead of
running without those constraints.

GitHub contains application code, not your MongoDB contents or the ignored
`server/data` directory. Connect to the intended database. For a new database,
run `npm run seed:catalogue --prefix server` with its configured environment,
then create/import your questions and provision your administrator account.
Do not run seeding against an existing catalogue without reviewing it.

Question images can persist in the existing MongoDB database's `question_media`
collection. The app reads local images first and falls back to MongoDB, including
when sending diagrams to the AI tutor. Image requests still require login.
From the computer containing the imported files, run `npm run media:upload --prefix server`
to validate every referenced WebP and preview the upload. Then run
`npm run media:upload --prefix server -- --apply` to upload new or changed images.
The script uses `server/.env`, or `DOTENV_CONFIG_PATH` when set, and reads files
from `QUESTION_MEDIA_DIR` or `server/data/question-media`. It never deletes media.
Check your database's storage quota first. Re-run after future question imports;
a Git push does not upload images. Do not commit private image files or secrets.

### Refresh imported booklet artwork

The EC extractor omits visually verified publisher-logo image objects before
rendering question crops. It matches exact PDF image-stream hashes; it does not
erase grey pixels, rewrite equations, or remove arbitrary diagrams. Source
metadata remains available to administrators. This visual cleanup does not
grant publication rights: use content you own or have permission to republish.

To refresh an existing import without changing questions, answers, crop sizes,
or media URLs, run the following from the repository root (Python requires
`pypdfium2` with `FPDFPageObj_SetIsActive` and Pillow):

```powershell
python server/scripts/refreshBookletMedia.py --input server/data/ec-booklets.json --input server/data/digital-control-booklets.json --pdf-dir "C:/path/to/source-pdfs" --output-dir server/data/branding-cleanup
```

This validates the source PDF checksums and all existing crop dimensions, then
writes changed previews under the output directory. Inspect them and rerun
with `--apply` to replace the local images; changed originals are backed up
under `originals/`. Source PDFs and question datasets remain unchanged.
Upload the replacements with `npm run media:upload --prefix server -- --apply`.
The client media URL revision refreshes browser caches after the client build
is deployed; increment it again for future replacements at the same URLs.

Run `node server/scripts/refreshBookletLabels.js` to preview cleaning the
importer's default test labels and saved attempt titles. Add `--apply` to save
the changes with a local metadata backup. Custom test labels and question
source attribution are preserved. Both database scripts use `server/.env`,
or `DOTENV_CONFIG_PATH` when set.

The source-object matching checks run with
`python -m unittest discover -s server/tests -p "*_test.py"`; label cleanup
checks are included in `npm test --prefix server`.

The Blueprint uses Render's free plan. Its local files are ephemeral, but MongoDB
images survive redeploys. An optional persistent disk with `QUESTION_MEDIA_DIR`
also remains supported. Free services sleep when idle and have usage limits;
choose an appropriate paid plan before relying on uninterrupted exam availability.
Run one instance while rate limits use the built-in memory store; multiple
instances require a shared rate-limit store.

After deployment, verify `/health` returns `200`, then test registration,
login/logout, admin access, question images, exam submission and uploads over
HTTPS. A successful local build does not verify the live database or media.

Render references: [Blueprints](https://render.com/docs/blueprint-spec),
[environment variables](https://render.com/docs/environment-variables),
[Node version](https://render.com/docs/node-version),
[persistent disks](https://render.com/docs/disks).

## Importing free-source Chemical / CSE / IT questions

You can add public-domain or open-licence question sets from external learning platforms by placing a JSON file in a supported shape and running the import script.

Example payload:

```json
{
  "branchCode": "CS",
  "branchName": "Computer Science and Information Technology",
  "subjectName": "Algorithms",
  "chapterName": "Dynamic Programming",
  "testTitle": "Free platform sample",
  "sourceName": "NPTEL / Open educational resources",
  "questions": [
    {
      "questionNumber": 1,
      "questionText": "What is the time complexity of merge sort?",
      "questionType": "mcq",
      "options": ["O(n)", "O(log n)", "O(n log n)", "O(n^2)"],
      "correctAnswer": 2,
      "marks": 1,
      "negativeMarks": 0.33,
      "tags": ["sorting", "algorithms"],
      "difficulty": "medium"
    },
    {
      "questionNumber": 2,
      "questionText": "Find the sum of the first 10 natural numbers.",
      "questionType": "nat",
      "natAnswerMin": 55,
      "natAnswerMax": 55,
      "marks": 1
    }
  ]
}
```

Then run:

```powershell
npm run import:public --prefix server -- data/free-platform-sample.json
```

Use the same pattern for Chemical Engineering and IT sets by changing the `branchCode`, `branchName`, `subjectName`, and `chapterName` values. For licence-sensitive sources, check attribution and publication rights before importing.

## Importing the supplied MADE EASY CS sample

The supplied GATE 2026 CS/IT PDF is an **18-page sample**, although its contents
list an 805-page book. It contains Theory of Computation / Finite Automata and
Regular Languages questions 1.1-1.57, part of 1.58, and an answer table. Other
chapters and printed question pages 140-147 are absent.

The reviewed extractor preserves original diagrams and option artwork, joins
questions continued across columns/pages, and repeats common data where needed.
It checks the source checksum before using its reviewed crop coordinates.
Do not use this sample page map for a different PDF or the full book.

```powershell
python server/scripts/extractMadeEasyCs.py --pdf "C:/path/to/document_book_GATE-2026+Computer+Science+and+IT+Previous+Year+Solved+Papers.pdf"
npm run import:made-easy-cs --prefix server -- --validate-only
npm run import:made-easy-cs --prefix server
npm run import:made-easy-cs --prefix server -- --apply
```

The database command defaults to a read-only preview. Applying it reuses the
existing CS subject/chapter and creates three ECE-style `GATE PYQs - Set NN`
tests. Printed 1/2 marks are retained, with no negative marking for practice.
Question 1.7 (two printed answers for an MCQ) and question 1.58 (missing
continuation) remain unpublished review drafts. The other 56 questions publish.
Question 1.48 retains all five original answer options.

The importer validates every local crop, uploads its persistent MongoDB media,
and reads the bytes back before publishing tests. Source identities are stable
within the edition; repeat imports insert no duplicates and preserve existing
question edits. It refuses conflicting media and test ownership. Backups and
`import-report.json` are saved in ignored `server/data/made-easy-cs/`, alongside
the extracted dataset and crop review sheets. Source PDFs and private images
must remain outside Git. This content-only upload needs no frontend deployment.

## SSC, Railways and Banking maths practice

Registration includes separate SSC, Railways and Banking exam choices. Each
has its own Mathematics subject, 29 chapters and 84 practice sets (up to 20
questions per set). The supplied 248-page Railway Maths Smart Book contains
1,404 questions. These are Railway PYQs offered as maths practice for all three
exam choices, with one mark per question and no negative marking. Existing
GATE branches keep their own catalogue and shared GATE foundation subjects.

The extractor is bound to the reviewed PDF checksum. It retains the original
English/Hindi artwork, formulas and diagrams, joins 71 questions across
columns/pages, and extracts the printed answer tables separately. Some Hindi
lettering is already distorted in the source PDF; it is preserved rather than
replaced with guessed text. The fourth option of Algebra Q11 is printed `(s)`;
its answer control is labelled as the fourth option. Answer correctness follows
the printed keys. Solutions are not imported.

```powershell
python server/scripts/extractRailwayMaths.py --pdf "C:/path/to/Railway-MATHS-Smart-Book-1400-Chapterwise-PYQs-Aditya-Ranjan-Sir-Bilngual.pdf" --output server/data/railway-maths/questions.json --media-dir server/data/question-media
npm run import:railway-maths --prefix server -- --validate-only
npm run import:railway-maths --prefix server
npm run import:railway-maths --prefix server -- --apply
```

Python needs pypdfium2 and Pillow. The importer defaults to a read-only plan,
checks source identity, all question/answer counts, and all image files before
writing. It reads `server/.env` (or `DOTENV_CONFIG_PATH`) without printing secrets.
The same 1,404 images are stored once in MongoDB and verified by checksum before
tests are published; each exam choice gets its own question records to preserve
branch isolation. Repeat imports preserve existing question edits and publication
choices. Source files, backups and the import report remain in ignored
`server/data/`. Deploy the frontend/server update as well as applying the import.

## Hostinger deployment

This application is deployed as one Node.js app. Build the React client first,
then start the server from the repository's `server` directory.

1. Install dependencies in both directories: `cd client && npm ci`, then
	`cd ../server && npm ci --omit=dev`.
2. Build the client: `cd ../client && npm run build`.
3. Configure the Hostinger Node.js application with startup file
	`server/server.js` and the Node version supported by the application.
4. Set these server environment variables in Hostinger:
	`NODE_ENV=production`, `MONGO_URI` (MongoDB Atlas or another TLS MongoDB
	URI), `JWT_SECRET` (a new random value of at least 48 characters),
	`CLIENT_ORIGIN=https://your-domain.example`, and `TRUST_PROXY=1` when
	Hostinger is the single reverse-proxy hop in front of Node.
5. Set `VITE_API_URL=/api` while building the client. Do not put database
	credentials or JWT secrets in any `VITE_` variable.
6. Allow the Hostinger server IP in the MongoDB provider's network access list.
	Use a persistent writable directory for `QUESTION_MEDIA_DIR` if uploaded
	or imported question media must survive redeploys.

The app serves the built SPA, `/api`, and protected `/question-media` from the
same HTTPS origin. `/health` returns `200` only after MongoDB is connected;
Hostinger health checks should use that endpoint.

Before switching DNS, verify login, logout, admin access, student test start,
answer submission, and spreadsheet upload over HTTPS. Do not use the example
secret or development origins in production.
