import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/packages/firebase/config'
import { firebaseAuthStore } from '@/stores/firebaseAuthStore'

// Listen for Firebase auth state changes and sync to our store
onAuthStateChanged(auth, (user) => {
  firebaseAuthStore.getState().setUser(user)
})
