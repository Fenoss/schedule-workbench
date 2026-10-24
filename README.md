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

## Who can do what

| Role | Team projects | Private projects | Users |
|---|---|---|---|
| Pending (new sign-up) | nothing | nothing | — |
| Viewer | open and compare periods | create and manage their own | — |
| Contributor | create projects, save periods, delete what they saved | yes | — |
| Admin | everything | their own only | approve users and set roles |

The first person to sign in becomes the admin. Everyone after that starts as **Pending** until an admin approves them from the account menu → **Manage users**. The database enforces these rules (row-level security), not only the page.

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
Open the site and sign in. You become the admin. To approve everyone from one company automatically, run this in the SQL editor:

```sql
insert into public.app_settings (id, auto_approve_domain, auto_approve_role)
values (1, 'yourcompany.com', 'viewer')
on conflict (id) do update set auto_approve_domain = excluded.auto_approve_domain,
                               auto_approve_role  = excluded.auto_approve_role;
```

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

## Free-tier limits worth knowing
- **Supabase free plan:** about 500 MB of database and 1 GB of file storage, and projects pause after about a week without activity. XER files are stored compressed, typically a tenth of their size. Upgrade to Pro to stop pausing.
- **Upload size:** the `xer` storage bucket accepts files up to 50 MB each.
