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
