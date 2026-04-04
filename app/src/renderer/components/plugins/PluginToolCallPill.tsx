import { Box, Code, Collapse, Group, Stack, Text, UnstyledButton } from '@mantine/core'
import type { MessageToolCallPart } from '@shared/types'
import { IconCheck, IconChevronDown, IconCircleXFilled, IconLoader, IconPuzzle } from '@tabler/icons-react'
import { type FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { pluginController } from '@/packages/plugins/controller'
import { SpotifySearchResults } from './SpotifySearchResults'

// ─── Spotify search result detection ────────────────────────────────

interface SpotifySearchResult {
  results: Array<{
    name: string
    artists: string
    uri: string
    album?: string
    duration_ms?: number
    imageUrl?: string
  }>
  message?: string
}

function extractSpotifySearchResults(part: MessageToolCallPart): SpotifySearchResult | null {
  if (part.toolName !== 'spotify_search') return null
  const result = part.result as Record<string, unknown> | undefined
  if (!result || typeof result !== 'object') return null
  const items = result.results
  if (!Array.isArray(items)) return null
  return result as unknown as SpotifySearchResult
}

// ─── Component ──────────────────────────────────────────────────────

export const PluginToolCallPill: FC<{ part: MessageToolCallPart }> = ({ part }) => {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const manifest = pluginController.getManifestForTool(part.toolName)

  const isLoading = part.state === 'call'
  const isError = part.state === 'error'

  const spotifyResults = !isLoading && !isError ? extractSpotifySearchResults(part) : null
  const hasRichResults = spotifyResults !== null && spotifyResults.results.length > 0

  const bgColor = isError
    ? 'color-mix(in srgb, var(--chatbox-tint-error) 8%, transparent)'
    : 'var(--chatbox-background-gray-secondary)'

  const iconColor = isLoading
    ? 'var(--chatbox-tint-brand)'
    : isError
      ? 'var(--chatbox-tint-error)'
      : 'var(--chatbox-tint-success)'

  // Strip plugin prefix for display (chess_make_move → make_move)
  const displayName = manifest
    ? part.toolName.replace(`${manifest.id}_`, '').replaceAll('_', ' ')
    : part.toolName.replaceAll('_', ' ')

  const label = manifest ? `${manifest.name}: ${displayName}` : displayName

  const summary = hasRichResults ? `${spotifyResults.results.length} results` : undefined

  return (
    <Stack gap={6} mb="xs">
      {/* Rich Spotify search results — rendered above the pill like Ross's reference */}
      {hasRichResults && <SpotifySearchResults results={spotifyResults.results} />}

      <UnstyledButton onClick={() => setExpanded((prev) => !prev)}>
        <Group
          gap={6}
          px={10}
          py={2}
          style={{
            borderRadius: 'var(--mantine-radius-xl)',
            backgroundColor: bgColor,
            display: 'inline-flex',
          }}
        >
          <IconPuzzle size={13} color={iconColor} style={{ flexShrink: 0 }} />
          <Text size="xs" fw={500} c={isError ? 'chatbox-error' : undefined} lh={1}>
            {label}
          </Text>
          {isLoading ? (
            <IconLoader
              size={11}
              className="animate-spin"
              color="var(--chatbox-tint-brand)"
              style={{ flexShrink: 0 }}
            />
          ) : isError ? (
            <IconCircleXFilled size={11} color="var(--chatbox-tint-error)" style={{ flexShrink: 0 }} />
          ) : (
            <>
              <IconCheck size={11} color="var(--chatbox-tint-success)" style={{ flexShrink: 0 }} />
              {summary && (
                <Text size="xs" c="chatbox-tertiary" lh={1}>
                  · {summary}
                </Text>
              )}
            </>
          )}
          <IconChevronDown
            size={11}
            style={{
              flexShrink: 0,
              transform: expanded ? 'rotate(180deg)' : undefined,
              transition: 'transform 150ms',
            }}
          />
        </Group>
      </UnstyledButton>

      <Collapse in={expanded}>
        <Box
          ml={4}
          pl="sm"
          style={{
            borderLeft: `2px solid ${isError ? 'var(--chatbox-tint-error)' : 'var(--chatbox-tint-success)'}`,
          }}
        >
          <Stack gap="xs">
            <Box>
              <Text size="xs" c="chatbox-tertiary" fw={500} mb={2}>
                {t('Arguments')}
              </Text>
              <Code block>{JSON.stringify(part.args, null, 2)}</Code>
            </Box>
            {!!part.result && (
              <Box>
                <Text size="xs" c="chatbox-tertiary" fw={500} mb={2}>
                  {t('Result')}
                </Text>
                <Code block>{JSON.stringify(part.result, null, 2)}</Code>
              </Box>
            )}
          </Stack>
        </Box>
      </Collapse>
    </Stack>
  )
}
