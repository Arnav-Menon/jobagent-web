// Firebase web config. The API key is injected at build time (GitHub Actions secret
// VITE_FIREBASE_API_KEY, or .env.local for local dev) and is never committed. It is a
// browser key restricted to Firebase Auth APIs and this site's origins; access is
// enforced by Firebase Auth + the invite-only API.
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined
if (!apiKey) throw new Error('VITE_FIREBASE_API_KEY is not set (see README)')

export const firebaseConfig = {
  apiKey,
  authDomain: 'jobagent-1nh7n5.firebaseapp.com',
  projectId: 'jobagent-1nh7n5',
  appId: '1:435042219616:web:b189edffb331efa45b7505',
  messagingSenderId: '435042219616',
}

export const API_URL = 'https://jobagent-api-435042219616.us-east1.run.app'
