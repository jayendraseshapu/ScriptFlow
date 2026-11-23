# ScriptFlow — cloud-ready content workspace

ScriptFlow is an installable responsive web app. This version adds Supabase email/password authentication and private per-user cloud sync. Each account can access its own scripts and settings from any device.

## Stack
- Static frontend: HTML, CSS, JavaScript
- Authentication + database: Supabase
- Hosting: Vercel (deploy from GitHub)
- Install: PWA manifest; use the browser's Install App / Add to Home Screen option

## 1. Create the Supabase project
1. Create a project at https://supabase.com/dashboard.
2. In **Project Settings → API**, copy the Project URL and anon/publishable key.
3. Open the SQL Editor and run the complete contents of `supabase/schema.sql`.
4. In Authentication → URL Configuration, add your deployed Vercel URL to Site URL and Redirect URLs. For local development, also add `http://localhost:8000/**`.
5. Email/password authentication is enabled by default. You can configure email confirmation under Authentication → Providers → Email.

## 2. Configure ScriptFlow
Edit `config.js`:
```js
window.SCRIPTFLOW_CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY'
};
```
The anon/publishable key is designed for browser use. **Never put the Supabase service_role/secret key in this file.** Row Level Security is enabled by the SQL schema; do not disable it.

## 3. Run locally
```bash
python -m http.server 8000
```
Open http://localhost:8000.

## 4. Publish with GitHub + Vercel
1. Create a **public** GitHub repository named `scriptflow`.
2. Upload the contents of this folder to the repository root (not the containing folder).
3. In Vercel, choose **Add New → Project**, import the GitHub repository, and deploy. No build command is required; the project is static.
4. Add the Vercel domain to Supabase Authentication URL Configuration.
5. Redeploy if you change `config.js`.

After deployment, share the Vercel URL. Anyone can create their own account; users cannot read or change another user's workspace because of the database row-level security policies.

## Install on devices
- Desktop Chrome/Edge: open the deployed URL → browser menu → **Install ScriptFlow** (if offered).
- Android Chrome: open the URL → menu → **Install app** / **Add to Home screen**.
- iPhone/iPad Safari: Share → **Add to Home Screen**.

## Data and limitations
- The app stores one JSON workspace row per authenticated user in Supabase. The database policy restricts each row to its owner.
- The first sign-in on a browser migrates that browser's previous local ScriptFlow data into that account if no cloud row exists yet.
- Daily 6 PM reminders are still browser notifications and require the app/browser to be active. Reliable notifications when all browsers are closed require a push-notification service and server-side scheduling; this is not included in this build.
- This is a static client app. Keep Supabase's email confirmation, password policies, backups, and RLS enabled for a public launch.
