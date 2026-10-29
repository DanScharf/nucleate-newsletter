# Nucleate – Technion Branch · Team Desk

The team site (newsletter pipeline, calendar, tasks, events, contacts) plus a public page for students.
The site files are hosted on GitHub Pages. The data and Google sign-in live in Firebase (project `nucleate-newsletter`).

## Files

| File | What it is |
|---|---|
| `index.html` | The team site (page layout and styles) |
| `app.js` | The team site's features |
| `firebase-backend.js` | Sign-in and database connection. Contains the owner email |
| `firebase-config.js` | Which Firebase project to use. **Don't change it** |
| `public.html` | Public page: published issues, upcoming events, suggestion form |
| `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png` | Let people install the site on their phone |
| `firestore.rules` | Security rules. Paste into Firebase → Firestore → Rules (not needed on GitHub) |

## Updating the site
1. **Rules first** (only when `firestore.rules` changed): Firebase console → Firestore → Rules → replace everything → **Publish**.
2. **Then the files:** GitHub repo → Add file → Upload files → drag in everything except `firestore.rules` → Commit changes.
3. Wait 1–2 minutes, then hard-refresh (Cmd+Shift+R).
4. Before big updates: Settings → **Download backup**.

Uploading new files never deletes data. The data lives in Firebase, not on GitHub.

## Roles
- **Owner** (scharfdan2000@gmail.com): always an admin. Set in `firestore.rules` and `firebase-backend.js`.
- **Admins:** edit or delete anything, send issues, manage sources, settings, backups and the team list.
- **Members:** add items, tasks, meetings, events and contacts, vote, comment, RSVP, tick checklists and tasks, move items into the issue, and edit their own work.
- Add or remove people on the site: **Team → Who has access**.

## Addresses
- Team site: `https://danscharf.github.io/nucleate-newsletter/`
- Public page: `https://danscharf.github.io/nucleate-newsletter/public.html`

## Security notes
- The Firebase API key in `firebase-config.js` is public by design. GitHub may flag it; close that alert as "False positive".
  To limit it, go to Google Cloud console → APIs & Services → Credentials → the Firebase browser key → Application restrictions → Websites:
  `https://danscharf.github.io/*` and `https://nucleate-newsletter.firebaseapp.com/*`.
- Firebase → Authentication → Settings → Authorized domains must include `danscharf.github.io`.

## Troubleshooting
- **"This account isn't on the team yet":** add the email on the Team page (as owner/admin).
- **"You don't have permission":** the person is a Member trying an admin action, or the rules weren't published.
- **"This website address isn't approved":** add the domain under Authorized domains.
- **Changes don't show:** wait 2 minutes and hard-refresh.
