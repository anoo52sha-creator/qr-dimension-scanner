# QR Dimension Scanner

A production-ready Android application + Node.js/Express REST API + PostgreSQL system for scanning QR codes containing **arbitrary, dynamic JSON payloads** and persisting them without predefined dimension columns or data loss.

## Key Capabilities

- **100% Dynamic JSON Support:** Accepts any valid JSON structure (arbitrary property names, nested objects, arrays, strings, integers, decimals, booleans, `null`).
- **Zero Data Loss:** Stores both the exact raw QR text (`TEXT`) and parsed structured JSON (`JSONB` with GIN index) in PostgreSQL.
- **Interactive JSON Preview:** Tree view with expand/collapse for nested objects & arrays, syntax highlighting, pretty-print toggle, and one-tap copy.
- **Duplicate QR Detection:** Detects identical payloads in PostgreSQL, warns the user, and allows saving duplicates only upon confirmation.
- **Scan History & Search:** Paginated history sorted newest first, dynamic search across any JSON property or value, date range filters, and `.json` file download.
- **Cloud-Built Android APK:** Built entirely on GitHub Actions using Capacitor and `@capacitor-mlkit/barcode-scanning` — **no local Android Studio or Android SDK required**.

---

## Repository Structure

```text
qr-dimension-scanner/
├── frontend/                  # React + Vite + TypeScript + Capacitor
│   ├── scripts/
│   │   └── configure-android.mjs
│   ├── src/
│   │   ├── components/
│   │   │   └── JsonTreeViewer.tsx
│   │   ├── screens/
│   │   │   ├── HomeScreen.tsx
│   │   │   ├── ScannerScreen.tsx
│   │   │   ├── JsonPreviewScreen.tsx
│   │   │   ├── HistoryScreen.tsx
│   │   │   ├── RecordDetailScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   └── scanner.ts
│   │   ├── types/
│   │   │   └── scan.ts
│   │   └── utils/
│   │       └── jsonUtils.ts
│   ├── capacitor.config.ts
│   └── package.json
├── backend/                   # Node.js + Express + pg REST API
│   ├── src/
│   │   ├── db/pool.js
│   │   ├── routes/scans.js
│   │   ├── utils/jsonValidator.js
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/scans.test.js
│   └── package.json
├── database/
│   └── schema.sql             # PostgreSQL table & indexes
├── .github/
│   └── workflows/
│       └── build-android.yml  # Remote APK build via GitHub Actions
├── render.yaml                # Render deployment blueprint
├── .env.example
└── .gitignore
```

---

## 1. Local Development Setup

### PostgreSQL (Local Dev Only)
Create the database and apply `database/schema.sql`:
```sql
CREATE DATABASE qr_dimensions_db;
```
Run `database/schema.sql` against `qr_dimensions_db`.

### Backend
```bash
cd backend
npm install
# Create backend/.env with DATABASE_URL=postgresql://postgres:Postgre@localhost:5432/qr_dimensions_db
npm run dev
```

### Frontend
```bash
cd frontend
npm install
# Optional: create frontend/.env with VITE_API_BASE_URL=http://localhost:5000
npm run dev
```

---

## 2. Cloud Deployment (Neon/Render PostgreSQL + Render Backend)

1. **Create Cloud PostgreSQL (Neon or Render PostgreSQL):**
   - Create a database named `qr_dimensions_db` (or use the default database provided).
   - Run `database/schema.sql` in the SQL Editor (the backend also auto-verifies the schema on startup).
   - Copy the **External Connection String** (`postgresql://...?sslmode=require`).

2. **Deploy Backend on Render:**
   - Push this repository to GitHub (`qr-dimension-scanner`).
   - On Render, click **New + -> Web Service** (or **Blueprint** using `render.yaml`).
   - Set Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment Variables:
     - `DATABASE_URL`: *(Your Neon or Render PostgreSQL connection string)*
     - `DATABASE_SSL`: `true`
     - `NODE_ENV`: `production`
     - `CORS_ORIGIN`: `*`
   - Verify deployment by visiting `https://<your-render-service>.onrender.com/api/health`.

---

## 3. GitHub Actions APK Build (No Local Android SDK Needed)

1. In your GitHub repository, go to **Settings -> Secrets and variables -> Actions**.
2. Add a repository secret:
   - Name: `VITE_API_BASE_URL`
   - Value: `https://<your-render-service>.onrender.com` *(no trailing slash)*
3. Push to `main` (or go to **Actions -> Build Android APK -> Run workflow**).
4. Once the workflow finishes, open the workflow run and download **`qr-dimension-scanner-apk`** from **Artifacts**.
5. Extract `qr-dimension-scanner.apk` and install it on your Android device (enable *Install from unknown sources* if prompted).

### Creating a GitHub Release
To publish a release with the APK attached:
1. Download `qr-dimension-scanner.apk` from the workflow Artifacts (or add `softprops/action-gh-release@v2` on tag push).
2. On GitHub, go to **Releases -> Draft a new release**, tag `v1.0.0`, attach `qr-dimension-scanner.apk`, and click **Publish release**.
