import { createStore } from 'zustand/vanilla'
import { persist } from 'zustand/middleware'
import type { User } from 'firebase/auth'

export interface FirebaseAuthState {
  uid: string | null
  email: string | null
  displayName: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface FirebaseAuthActions {
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  clear: () => void
}

const initialState: FirebaseAuthState = {
  uid: null,
  email: null,
  displayName: null,
  isAuthenticated: false,
  isLoading: true,
}

export const firebaseAuthStore = createStore<FirebaseAuthState & FirebaseAuthActions>()(
  persist(
    (set) => ({
      ...initialState,
      setUser: (user: User | null) =>
        set({
          uid: user?.uid ?? null,
          email: user?.email ?? null,
          displayName: user?.displayName ?? null,
          isAuthenticated: !!user,
          isLoading: false,
        }),
      setLoading: (loading: boolean) => set({ isLoading: loading }),
      clear: () => set({ ...initialState, isLoading: false }),
    }),
    {
      name: 'firebase-auth',
      partialize: (state) => ({
        uid: state.uid,
        email: state.email,
        displayName: state.displayName,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)

// React hook helper
import { useStore } from 'zustand'

export function useFirebaseAuthStore<T>(selector: (state: FirebaseAuthState & FirebaseAuthActions) => T): T {
  return useStore(firebaseAuthStore, selector)
}
