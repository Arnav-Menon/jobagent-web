# jobagent-web

Static frontend for Job Agent, served by GitHub Pages at https://arnav-menon.github.io/jobagent-web/.

- Google sign-in via Firebase Auth; access is invite-only and enforced by the backend API.
- No keys are committed. The Firebase browser key is injected at build time from the `VITE_FIREBASE_API_KEY`
  Actions secret (local dev: put it in `.env.local`, which is git-ignored). It is restricted to Firebase Auth
  APIs and this site's origins.
- Backend and agent: private repo `jobagent` (see its `docs/MULTI_USER_DESIGN.md`).

```sh
npm install
npm run dev     # http://localhost:5173/jobagent-web/
npm run build
```
