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

The Blueprint uses Render's free plan for initial verification. Local files
on Render are ephemeral. For production with imported question images, use a
paid service with a persistent disk, set `QUESTION_MEDIA_DIR` to its mount
directory (for example `/var/data/question-media`), and copy your existing
question-media subdirectories there. A Git push does not upload those images.
Run one instance while rate limits use the built-in memory store; multiple
instances require a shared rate-limit store.

After deployment, verify `/health` returns `200`, then test registration,
login/logout, admin access, question images, exam submission and uploads over
HTTPS. A successful local build does not verify the live database or media.

Render references: [Blueprints](https://render.com/docs/blueprint-spec),
[environment variables](https://render.com/docs/environment-variables),
[Node version](https://render.com/docs/node-version),
[persistent disks](https://render.com/docs/disks).

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
