import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getDatabase } from 'firebase/database'
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL
}

// Auth credentials (same as ESP32)
const AUTH_EMAIL = import.meta.env.VITE_FIREBASE_AUTH_EMAIL
const AUTH_PASSWORD = import.meta.env.VITE_FIREBASE_AUTH_PASSWORD

console.log('🔥 [Firebase] Initializing with config:', {
  projectId: firebaseConfig.projectId,
  databaseURL: firebaseConfig.databaseURL,
  authDomain: firebaseConfig.authDomain
})

export const app = initializeApp(firebaseConfig)

isSupported()
  .then((ok) => { if (ok) getAnalytics(app) })
  .catch(() => {})

export const db = getDatabase(app)
export const auth = getAuth(app)

// Sign in with email/password (same credentials as ESP32)
if (AUTH_EMAIL && AUTH_PASSWORD) {
  console.log('🔐 [Firebase] Signing in with email:', AUTH_EMAIL)
  signInWithEmailAndPassword(auth, AUTH_EMAIL, AUTH_PASSWORD)
    .then((userCredential) => {
      console.log('✅ [Firebase] Signed in successfully as:', userCredential.user.email)
    })
    .catch((error) => {
      console.error('❌ [Firebase] Auth error:', error.code, error.message)
      if (error.code === 'auth/invalid-credential') {
        console.log('💡 [Firebase] Check that the email/password in .env matches Firebase Authentication users')
      }
    })
} else {
  console.warn('⚠️ [Firebase] No auth credentials in .env file')
  console.log('   Add VITE_FIREBASE_AUTH_EMAIL and VITE_FIREBASE_AUTH_PASSWORD to .env')
}

// Log auth state changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('🔐 [Firebase] Auth state: Signed in as', user.email, '| UID:', user.uid)
  } else {
    console.log('🔐 [Firebase] Auth state: Signed out')
  }
})
