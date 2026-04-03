import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/packages/firebase/config'
import { firebaseAuthStore } from '@/stores/firebaseAuthStore'
import { exchangeFirebaseToken } from '@/packages/supabase/config'

// Listen for Firebase auth state changes and sync to our store.
// When a user is already signed in (e.g. page refresh), exchange
// their Firebase token for a Supabase JWT so RLS works immediately.
onAuthStateChanged(auth, async (user) => {
  firebaseAuthStore.getState().setUser(user)

  if (user) {
    try {
      const idToken = await user.getIdToken()
      await exchangeFirebaseToken(idToken)
    } catch (err) {
      console.error('Failed to exchange Firebase token for Supabase JWT:', err)
    }
  }
})
