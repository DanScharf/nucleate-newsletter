# Digest Desk

A shared workspace for collecting sources and finds and turning them into a weekly WhatsApp newsletter.
The page is hosted free on GitHub Pages. Data and Google sign-in are handled free by Firebase.

## Files

| File | What it is | Edit it? |
|---|---|---|
| `index.html` | The app | No |
| `firebase-backend.js` | Connects the app to Firebase | No |
| `firebase-config.js` | Your Firebase project's settings | **Yes**, once (step 4) |
| `firestore.rules` | Who may read and write the data | **Yes**: your emails (step 3) |

## Setup (about 15 minutes)

### 1. Create the Firebase project
1. Go to https://console.firebase.google.com and sign in with your Google account.
2. Click **Create a project**, name it (e.g. `nucleate-newsletter`), and click through. Google Analytics isn't needed, so you can turn it off.

### 2. Turn on Google sign-in
1. In the left menu, open **Build → Authentication** and click **Get started**.
2. Under **Sign-in method**, choose **Google**, switch it **on**, pick your support email, and click **Save**.

### 3. Create the database and lock it down
1. Open **Build → Firestore Database** and click **Create database**.
2. If asked for an edition, choose **Standard**. Pick a location near you (e.g. `eur3 (europe-west)`) and start in **production mode**.
3. Open the **Rules** tab, delete everything there, and paste the contents of `firestore.rules`.
4. Replace the two example emails with your Google email and your friend's (lowercase), then click **Publish**.

### 4. Register the web app and copy its settings
1. Click the gear icon → **Project settings** → **General**. Under **Your apps**, click the web icon `</>`.
2. Name it `nucleate-newsletter` (don't tick Firebase Hosting) and click **Register app**.
3. You'll see a `firebaseConfig = { ... }` block. Copy its values into `firebase-config.js`, replacing the placeholders.

### 5. Put it on GitHub Pages
1. On https://github.com click **New repository**. Name it `nucleate-newsletter` and make it **Public** (free Pages needs public repos; your data stays private because it lives in Firebase).
2. Click **uploading an existing file** and drag in all four files (`index.html`, `firebase-backend.js`, `firebase-config.js`, `firestore.rules`) plus this README. Click **Commit changes**.
3. Go to **Settings → Pages**. Under **Build and deployment**, set Source to **Deploy from a branch**, Branch to **main** and folder to **/(root)**, then click **Save**.
4. After about 1 minute your site is live at `https://YOUR-GITHUB-USERNAME.github.io/nucleate-newsletter/`.

### 6. Allow your website to use Google sign-in
1. In Firebase, open **Authentication → Settings → Authorized domains** and click **Add domain**.
2. Add `YOUR-GITHUB-USERNAME.github.io` (no `https://`, no `/nucleate-newsletter`).

### 7. Open it
Go to your site and click **Sign in with Google**. Send the link to your friend, who signs in with the email you put in the rules.

## Everyday tasks
- **Add someone:** add their email to the rules (Firestore → Rules) and click **Publish**. Nothing on GitHub changes.
- **Remove someone:** delete their email from the rules and click **Publish**.
- **Update the app:** upload the new `index.html` to the repository (replace the old one).
- **Back up the data:** Firestore → Data shows everything. For backups, Google Cloud's Firestore export works, though it's rarely needed at this size.

## Troubleshooting
- **"This website address isn't approved"** means step 6 is missing or has a typo.
- **"This account isn't on the access list"** means the email in the rules doesn't exactly match the Google account used. Check for typos and capital letters, and that you clicked Publish.
- **The page says "Almost there"** means `firebase-config.js` still has the placeholders.
- **Changes don't appear on the site:** GitHub Pages can take 1–2 minutes. Then hard-refresh (Cmd+Shift+R).

## Cost
Firebase's free Spark plan includes 50,000 reads and 20,000 writes per day and 1 GiB of storage. Two people running a weekly newsletter use a tiny fraction of that. No credit card is needed.
