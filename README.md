# Sam Cricket Portal

Cricket attendance portal with Firebase Authentication for admin access and Firebase Realtime Database for match details and live player availability.

## Firebase setup

1. Open the Firebase project configured in `firebase-config.js`.
2. In **Authentication → Sign-in method**, enable **Email/Password**.
3. In **Authentication → Users**, create the authorized admin account. The email must match `FIREBASE_ADMIN_EMAIL` in `firebase-config.js`. The password is managed only by Firebase; there is no password in this repository.
4. Enable **Realtime Database** and publish these rules. If you change the admin email, update it in both this ruleset and `firebase-config.js`.

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "matchData": {
      ".read": true,
      ".write": "auth != null && auth.token.email === 'sameerarif133@gmail.com'",
      "players": {
        ".read": true,
        ".write": true,
        "$playerId": {
          ".validate": "newData.hasChildren(['id', 'name', 'status', 'timeStr', 'timestamp']) && newData.child('id').val() === $playerId && (newData.child('status').val() === 'ON' || newData.child('status').val() === 'OFF')"
        }
      }
    }
  }
}
```

The public portal can read match details and submit player availability. Only the authorized Firebase account can change match details. Player availability is intentionally writable without admin sign-in so players can RSVP; keep the validation rules enabled and do not use Firebase test mode.

The web app uses the Firebase project settings in `firebase-config.js`. Update that file if deploying to a different Firebase project. Firebase web API keys identify a project; access control must be enforced by Authentication and Realtime Database rules.

## Run locally

```sh
npm install
npm start
```

Then open `http://localhost:3000`. Match information and player records are fetched from Firebase in real time; the app does not use a local JSON roster or a demo login.

## Deploy

Deploy the static site files to Netlify or another static host. Netlify serves the app; Firebase provides authentication and data storage. The Node.js server in `server.js` is only a local static-file server and does not provide a separate login or data API.

## Main files

- `index.html` — portal UI and Firebase SDK imports.
- `app.js` — RSVP, Firebase Authentication, and Realtime Database interactions.
- `firebase-config.js` — Firebase project config and authorized admin email.
- `server.js` — local static-file server.
