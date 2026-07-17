import { Box, Link, Tooltip, Typography } from '@mui/material';

import { formatDuration } from '@/lib/format';
import type { RunAttempt } from '@/lib/github';

import { getConclusionStyle } from './conclusion';
import { formatDateTime } from './format';

interface AttemptNodesProps {
  attempts: RunAttempt[];
}

const NODE_SIZE = 30;

/**
 * Renders one node per attempt ("try"), colored by that attempt's conclusion.
 * A single-attempt run shows a single node; a retried run shows a node per try,
 * connected left-to-right in attempt order.
 */
export default function AttemptNodes({ attempts }: AttemptNodesProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      {attempts.map((attempt, i) => {
        const style = getConclusionStyle(attempt.conclusion, attempt.status);
        return (
          <Box key={attempt.attempt} sx={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && (
              <Box
                aria-hidden
                sx={{ width: 20, height: 2, bgcolor: 'divider' }}
              />
            )}
            <Tooltip
              title={
                <Box>
                  <Typography variant="caption" display="block" sx={{ fontWeight: 600 }}>
                    Try {attempt.attempt} — {style.label}
                  </Typography>
                  <Typography variant="caption" display="block">
                    {formatDateTime(attempt.startedAt)}
                    {attempt.durationMs !== null
                      ? ` · ${formatDuration(attempt.durationMs)}`
                      : ''}
                  </Typography>
                </Box>
              }
            >
              <Link
                href={attempt.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Try ${attempt.attempt}: ${style.label}. Open on GitHub.`}
                sx={{
                  width: NODE_SIZE,
                  height: NODE_SIZE,
                  borderRadius: '50%',
                  bgcolor: style.color,
                  color: 'common.white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  border: '2px solid',
                  borderColor: 'background.paper',
                  boxShadow: 1,
                  transition: 'transform 0.1s',
                  '&:hover': { transform: 'scale(1.12)' },
                }}
              >
                {attempt.attempt}
              </Link>
            </Tooltip>
          </Box>
        );
      })}
    </Box>
  );
}
