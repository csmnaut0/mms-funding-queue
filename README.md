# MMS Funding Queue

Live list of loans assigned for funding, fed by Arive → Zapier → this Netlify site.

```
public/index.html              dashboard (auto-refreshes every 30s)
netlify/functions/ingest.mts   POST /api/ingest  ← Zapier sends loan updates here
netlify/functions/loans.mts    GET  /api/loans   ← dashboard reads from here
```
Data is stored in Netlify Blobs (store: `funding-queue`), one record per loan number. A new update for the same loan overwrites the old one, so you never get duplicates.

## 1. Deploy
Deploy the whole `mms-funding-queue` folder, not just `public/`, because the functions have to build.
- **Recommended:** push the folder to a GitHub repo, then in Netlify go to **Add new project → Import from Git**. Netlify installs the packages and builds the functions on every push.
- **Drag-and-drop:** drop the folder at app.netlify.com/drop while logged in. Then check **Project → Logs → Functions**. If `ingest` and `loans` aren't listed, drag-and-drop didn't build them, so use the GitHub route instead.

## 2. Environment variables
Set these under **Project configuration → Environment variables**, then redeploy:

| Key | What it is |
|---|---|
| `INGEST_KEY` | A long random secret that only Zapier knows |
| `VIEW_KEY` | The access code the team types to view the dashboard |

## 3. Test the URL
Open `https://<your-site>.netlify.app/api/ingest?key=<INGEST_KEY>` in a browser. You should see `{"ok":true,"message":"Funding queue ingest is live"}`.

## 4. Zap
- **Trigger:** Arive (loan updated or loan status changed)
- **Action:** Webhooks by Zapier → **POST**
  - URL: `https://<your-site>.netlify.app/api/ingest?key=<INGEST_KEY>`
  - Payload type: **json**
  - Data (left = key exactly as written, right = mapped Arive field):

| Key | Map from Arive |
|---|---|
| loan_number | Loan number (**required**) |
| borrower | Borrower last name |
| status | Loan status / milestone |
| funder | Funder (if Arive exposes it) |
| closer | Closer (if exposed) |
| title_company | Title / settlement agent |
| loan_officer | LO name |
| processor | Processor |
| closing_date | Closing date |
| funding_date | Funding / disbursement date |
| loan_amount | Loan amount |
| property_state | Subject property state |

Leave out any field you don't have. Blank values never overwrite data already saved.
To remove a loan by hand, send `loan_number` plus `action` = `remove`.

## Adjusting
- Loans whose status matches funded, purchased, withdrawn, denied, cancelled, declined, adverse, archived or closed out are hidden by default (there's a checkbox to show them). Edit the `DONE` line near the top of the script in `index.html` so it matches Arive's exact status names.
- Loans are grouped by funding date, and by closing date if there's no funding date.
