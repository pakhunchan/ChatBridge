import { Button, Divider, Paper, Stack, Text, TextInput, Title } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { auth, googleProvider } from '@/packages/firebase/config'
import { supabase, exchangeFirebaseToken } from '@/packages/supabase/config'
import { firebaseAuthStore } from '@/stores/firebaseAuthStore'
import { router } from '@/router'
import { settingsStore } from '@/stores/settingsStore'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

const DEMO_USER_EMAIL = 'user123@chatbridge.dev'
const DEMO_USER_PASSWORD = 'chatbridge-demo-123'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)

  const handleEmailAuth = async () => {
    setError(null)
    setLoading(true)
    try {
      const fn = isSignUp ? createUserWithEmailAndPassword : signInWithEmailAndPassword
      const result = await fn(auth, email, password)
      firebaseAuthStore.getState().setUser(result.user)
      await exchangeFirebaseToken(await result.user.getIdToken())
      await syncUserToSupabase(result.user.uid, result.user.email)
      router.navigate({ to: '/', replace: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed'
      setError(message.replace('Firebase: ', ''))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setLoading(true)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      firebaseAuthStore.getState().setUser(result.user)
      await exchangeFirebaseToken(await result.user.getIdToken())
      await syncUserToSupabase(result.user.uid, result.user.email)
      router.navigate({ to: '/', replace: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed'
      setError(message.replace('Firebase: ', ''))
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    setError(null)
    setLoading(true)
    try {
      // Try sign in first, create account if it doesn't exist
      let result
      try {
        result = await signInWithEmailAndPassword(auth, DEMO_USER_EMAIL, DEMO_USER_PASSWORD)
      } catch {
        result = await createUserWithEmailAndPassword(auth, DEMO_USER_EMAIL, DEMO_USER_PASSWORD)
      }
      firebaseAuthStore.getState().setUser(result.user)
      await exchangeFirebaseToken(await result.user.getIdToken())
      await syncUserToSupabase(result.user.uid, result.user.email)

      // Load the demo user's API key into settings
      await loadApiKeysFromSupabase(result.user.uid)

      router.navigate({ to: '/', replace: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Demo login failed'
      setError(message.replace('Firebase: ', ''))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: 'var(--mantine-color-body)',
      }}
    >
      <Paper shadow="md" p="xl" radius="md" w={400} withBorder>
        <Stack gap="md">
          <Title order={2} ta="center">
            ChatBridge
          </Title>
          <Text size="sm" c="dimmed" ta="center">
            Sign in to sync your conversations and API keys
          </Text>

          <Button
            variant="light"
            color="teal"
            size="md"
            fullWidth
            onClick={handleDemoLogin}
            loading={loading}
          >
            Login as User123 (API key included)
          </Button>

          <Divider label="or sign in with your account" labelPosition="center" />

          <TextInput
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />
          <TextInput
            label="Password"
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEmailAuth()
            }}
          />

          {error && (
            <Text size="sm" c="red">
              {error}
            </Text>
          )}

          <Button fullWidth onClick={handleEmailAuth} loading={loading}>
            {isSignUp ? 'Create Account' : 'Sign In'}
          </Button>

          <Button variant="default" fullWidth onClick={handleGoogleSignIn} loading={loading}>
            Continue with Google
          </Button>

          <Text size="xs" c="dimmed" ta="center" style={{ cursor: 'pointer' }} onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </Text>
        </Stack>
      </Paper>
    </div>
  )
}

async function syncUserToSupabase(uid: string, email: string | null) {
  const { error } = await supabase.from('users').upsert(
    {
      id: uid,
      email: email ?? '',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )
  if (error) {
    console.error('Failed to sync user to Supabase:', error)
  }
}

async function loadApiKeysFromSupabase(uid: string) {
  const { data, error } = await supabase.from('api_keys').select('provider, api_key').eq('user_id', uid)

  if (error || !data?.length) return

  const { setSettings, providers: currentProviders } = settingsStore.getState()
  const providers = { ...currentProviders }

  for (const row of data) {
    providers[row.provider] = {
      ...providers[row.provider],
      apiKey: row.api_key,
    }
  }

  setSettings({ providers })
}
