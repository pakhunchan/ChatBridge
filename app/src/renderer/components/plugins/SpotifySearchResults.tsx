import { Box, Group, Image, Stack, Text } from '@mantine/core'
import { IconMusic } from '@tabler/icons-react'
import type { FC } from 'react'

interface SpotifyTrack {
  name: string
  artists: string
  uri: string
  album?: string
  duration_ms?: number
  imageUrl?: string
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const TrackRow: FC<{ track: SpotifyTrack; index: number }> = ({ track, index }) => {
  return (
    <Group
      gap={10}
      py={6}
      px={8}
      wrap="nowrap"
      style={{
        borderRadius: 'var(--mantine-radius-sm)',
        cursor: 'default',
        transition: 'background-color 150ms',
        ':hover': { backgroundColor: 'var(--chatbox-background-gray-secondary)' },
      }}
      className="hover:bg-[var(--chatbox-background-gray-secondary)]"
    >
      {/* Index number */}
      <Text size="xs" c="chatbox-tertiary" w={20} ta="right" style={{ flexShrink: 0 }}>
        {index + 1}
      </Text>

      {/* Album art */}
      {track.imageUrl ? (
        <Image
          src={track.imageUrl}
          w={40}
          h={40}
          radius={4}
          style={{ flexShrink: 0 }}
          alt={track.album ?? track.name}
        />
      ) : (
        <Box
          w={40}
          h={40}
          style={{
            flexShrink: 0,
            borderRadius: 4,
            backgroundColor: 'var(--chatbox-background-gray-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconMusic size={18} color="var(--chatbox-tint-placeholder)" />
        </Box>
      )}

      {/* Track + artist info */}
      <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
        <Text size="sm" fw={500} truncate="end" lh={1.3}>
          {track.name}
        </Text>
        <Text size="xs" c="chatbox-tertiary" truncate="end" lh={1.3}>
          {track.artists}
          {track.album ? ` \u00B7 ${track.album}` : ''}
        </Text>
      </Stack>

      {/* Duration */}
      {track.duration_ms != null && (
        <Text size="xs" c="chatbox-tertiary" style={{ flexShrink: 0 }}>
          {formatDuration(track.duration_ms)}
        </Text>
      )}
    </Group>
  )
}

export const SpotifySearchResults: FC<{ results: SpotifyTrack[] }> = ({ results }) => {
  if (results.length === 0) return null

  return (
    <Stack gap={2} mt={4} style={{ maxWidth: 440 }}>
      {results.map((track, index) => (
        <TrackRow key={track.uri} track={track} index={index} />
      ))}
    </Stack>
  )
}
