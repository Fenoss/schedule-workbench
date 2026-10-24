# Schedule Workbench

A browser-based workbench for Primavera P6 schedules. Load XER exports to compare baseline and live programmes in a Gantt or a time–location (TILOS-style) chart. It also runs the DCMA 14-point check, controls interface milestones, builds a Plan on a Page, builds schedules with a CPM engine, and asks AI to analyse or draft a programme. Each update can be saved as a **period**, and periods can be compared with each other.

The app is a single web page (`site/index.html`). In this repo it is hosted on **GitHub Pages**, with **Supabase** for sign-in, the database and file storage. An optional **Supabase Edge Function** calls Claude for the AI features.

```
site/index.html                      the app
site/config.js                       your Supabase settings (public values only)
supabase/schema.sql                  tables, file bucket and access rules — run once in Supabase
supabase/functions/ai-proxy/index.ts AI proxy that keeps your Anthropic key on the server
.github/workflows/pages.yml          publishes site/ to GitHub Pages on every push to main
```

## Companies and the workbench owner
One deployment can host several companies, each a **separate instance**: a company's people only ever see its own programmes, projects, updates, files and quality settings. The database enforces this.

- **Admin tab** (top bar, shown to admins and owners) has two parts:
  - **Workbench (owner)** — owners only: an overview across all companies; **Companies** (create, rename, suspend, add owner notes, delete empty ones, work in one); **Company admins** (make someone a company's admin by email, see companies with no admin); **All people** (move people between companies and set access); **Owners**.
  - **Your company** — company admins (and owners working in that company): **Overview**; **People** (approve, change access, remove); **Invitations**; **Sign-in & access** (company name, auto-join email domain and its access); **Branding** (title, accent colour and logo shown to everyone in the company); **Features** (switch AI, the Build tab and sample buttons on or off); **Quality checks**.
- **Workbench owner** (master admin): the first person to sign in. Owners can work in any company as its admin by choosing it under **Working in**. Add more owners on the Owners page.
- **Joining a company:** someone who signs in with an invited email joins that company with the invited access. Someone whose email matches a company's domain joins it automatically. Anyone else waits with no company until an admin invites them or the owner places them. The workbench doesn't send invitation emails, so tell people to sign in.

## Who can do what

| Role | Team projects | Private projects | Users |
|---|---|---|---|
| Pending (new sign-up) | nothing | nothing | — |
| Viewer | open and compare periods | create and manage their own | — |
| Contributor | create projects, save periods, delete what they saved | yes | — |
| Admin | everything | their own only | approve users and set roles |

Roles apply within a company. The workbench owner is an admin in every company. The database enforces these rules (row-level security), not only the page.

## Setup (about 20 minutes)

### 1. Create the Supabase project
1. Sign up at [supabase.com](https://supabase.com) and create a new project. Choose a region near your team and save the database password somewhere safe.
2. Open **SQL Editor → New query**, paste the whole of `supabase/schema.sql` and click **Run**. It is safe to run again, and re-running it is how you apply database updates when this file changes.

### 2. Point the app at it
1. In Supabase, copy the **Project URL** (the **Connect** button at the top) and the **publishable** key (**Project Settings → API Keys**, starts `sb_publishable_`). The older "anon" key also works.
2. Put them in `site/config.js` and commit. These two values are meant to be public. **Never** put the `service_role` key or your Anthropic key in this repo.

### 3. Turn on GitHub Pages
1. In this repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Push to `main`, or run the workflow from the **Actions** tab. The site appears at `https://fenoss.github.io/schedule-workbench/`.

> Free GitHub Pages needs a **public** repository. That is fine here: the page is public, but schedules are only visible after signing in. A private repository needs a paid GitHub plan to use Pages.

### 4. Allow sign-in to return to the site
In Supabase, open **Authentication → URL Configuration**:
- **Site URL**: `https://fenoss.github.io/schedule-workbench/`
- **Redirect URLs**: add the same address. Add `http://localhost:8000/` too if you test locally.

### 5. Email sign-in links
Email links work out of the box. Supabase's built-in email sender is rate-limited to a handful of emails an hour, so for a team set up your own SMTP under **Authentication → Emails → SMTP settings** (for example Resend, SendGrid, Postmark or Microsoft 365).

### 6. Sign in with Microsoft (optional)
1. In the [Azure portal](https://portal.azure.com) go to **Microsoft Entra ID → App registrations → New registration**.
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**, or a single tenant if only one company will sign in.
   - Redirect URI (Web): `https://<your-project-ref>.supabase.co/auth/v1/callback`
2. Under **Certificates & secrets**, create a client secret and copy its **Value**.
3. Under **Token configuration**, add the optional claim **email** to the ID token.
4. In Supabase, open **Authentication → Providers → Azure**, enable it, and paste the **Application (client) ID** and the secret. For a single tenant, set the Azure Tenant URL to `https://login.microsoftonline.com/<tenant-id>`.

Some company tenants stop staff from approving new apps themselves. If people see a "needs admin approval" message, ask that company's IT to grant consent, or use email links in the meantime. To hide either option, set `signIn` in `config.js`.

### 7. First sign-in
Open the site and sign in. You become the workbench owner and admin of the first company. Rename it, set an auto-approve email domain and invite people from the account menu → **Manage *company***, and add more companies from **Companies and people (owner)**.

### 8. AI features (optional)
The AI Analyst and AI schedule build call Claude through `supabase/functions/ai-proxy`, so your API key never reaches the browser. Usage is billed to your Anthropic account.

1. Create an API key at [console.anthropic.com](https://console.anthropic.com).
2. Deploy the function with the [Supabase CLI](https://supabase.com/docs/guides/cli):
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase functions deploy ai-proxy --no-verify-jwt
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
   Deploy with `supabase functions deploy ai-proxy --no-verify-jwt` (the function checks sign-in itself). You can also create it in the dashboard under **Edge Functions**: paste in `index.ts`, turn **Verify JWT** off, and add the secret under **Edge Functions → Secrets**.
3. Optional secrets:
   - `MODEL_QUICK`, `MODEL_DEFAULT` and `MODEL_COMPLEX` choose the models (defaults: Haiku, Sonnet and Opus 5.5).
   - `MAX_TOKENS_CAP` limits answer length.
   - `ALLOWED_ORIGIN` (e.g. `https://fenoss.github.io`) locks the function to your site.

Only signed-in, approved users can call the function. Edge functions have a time limit per request, so very long "Deep" generations can time out; use Standard depth if that happens. Set `ai: false` in `config.js` to hide AI features entirely.

## Using it
- **Portfolio** (the landing page after sign-in): every programme with its projects.
  - Each project shows its latest update, forecast finish, variance against baseline, movement since the last period, progress against plan, and BEI.
  - **Add programme** creates a group. **Add project** creates a *slot*: a named placeholder with programme, status, code and manager, which fills in when you add its first schedule update.
  - **Add first update** / **Update** reads a period's XER files and saves them as a period of that project. **Open** loads the latest period into the workbench.
- **Updating a live schedule in the app:** choose **Update** on a project, then **Update it here** (also on the Periods tab and the header menu).
  - Set the new data date, then enter actual start and finish, % complete and remaining durations. **Due this period** lists the activities that need statusing. **Status the rest as planned** progresses anything untouched as the last update forecast.
  - You can also change durations, logic and constraints, and add or delete activities. The CPM engine reschedules as you go, and the bar shows the finish movement against the last update and the baseline.
  - **Costs & notes** (or double-click a resource or cost cell) shows each activity's resource assignments (budget, actual and remaining units and costs), expenses and notebook text. **Resources** opens the resource dictionary. During an update, actuals and remaining follow each activity's progress until you change them by hand.
  - **Save as Update NN** writes the new live XERs from last period's files: progress, dates, logic, resources, costs and notes are updated, and everything else in P6 (calendars, cost accounts, roles, steps, user fields and so on) is kept as it was. The baseline is unchanged, and it saves straight away as the next period.
  - The editor reads P6 calendar work weeks and holidays from the XER, so rescheduling uses the real calendars.
- **Periods tab:**
  - Create a project, load the period's XER files, then choose **Save current as period**.
  - **Import past updates** turns a batch of monthly XERs into periods against the loaded baseline.
  - **Load sample history** creates a demo project.
- **Quality tab:** choose the check set from the bar: **DCMA 14-point**, **AACE enhanced** (25 checks drawn from AACE RPs 78R-13, 53R-06, 49R-06, 92R-17 and 90R-17, including dangling logic, out-of-sequence progress, near-critical density and changes since the previous update) or a **bespoke** set.
  - Admins choose **Configure checks** to set each check's pass and amber limits and parameters (such as the float or duration limit), switch checks off, build the bespoke set, and pick the default and which sets users can see. Settings are saved for everyone (the `quality_settings` table).
  - AACE describes what to review but sets no pass marks, so the AACE limits are starting points to agree for each project.
- **Account menu (top right):** switch between **Team** and **Private** workspaces, manage users (admins) and sign out.
- **Offline:** the app still works offline. Choose **Work offline on this device** and data stays in that browser only.

## Running locally
```bash
cd site && python3 -m http.server 8000
# open http://localhost:8000/ (add it to Supabase redirect URLs to sign in locally)
```

## Backups
`.github/workflows/backup.yml` makes a nightly, encrypted backup of the database and the XER file store and keeps each one for 30 days under **Actions → Nightly backup → Artifacts**. It is encrypted because this repository is public. Turn it on by adding three repository secrets (**Settings → Secrets and variables → Actions**):

| Secret | Where to get it |
|---|---|
| `SUPABASE_DB_URL` | Supabase → **Connect** → *Session pooler* connection string, with your database password filled in |
| `SUPABASE_SECRET_KEY` | Supabase → **Project Settings → API Keys** → *Secret keys* (create one) |
| `BACKUP_PASSPHRASE` | Any long passphrase. Keep a copy somewhere safe: without it the backups can't be opened. |

Run it once from the Actions tab to check it works. To restore: download the artifact, then
```bash
gpg -d workbench-backup-*.tar.gz.gpg | tar -xz        # asks for the passphrase
pg_restore --clean --if-exists --no-owner -d "$SUPABASE_DB_URL" workbench.dump
pg_restore --data-only --no-owner -d "$SUPABASE_DB_URL" auth-users.dump   # only into an empty project
# xer/ holds the stored files: upload them back to the 'xer' bucket with the same paths
```
Supabase **Pro** also adds daily backups and point-in-time recovery, and stops the project pausing after a week of inactivity.

## Free-tier limits worth knowing
- **Supabase free plan:** about 500 MB of database and 1 GB of file storage, and projects pause after about a week without activity. XER files are stored compressed, typically a tenth of their size. Upgrade to Pro to stop pausing.
- **Upload size:** the `xer` storage bucket accepts files up to 50 MB each.
