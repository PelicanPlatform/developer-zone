import { Box, Card, CardContent, Tooltip, Typography } from '@mui/material';
import { InfoOutlined } from '@mui/icons-material';

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
  help?: string;
  color?: string;
  icon?: React.ReactNode;
}

/** A single labelled metric tile. Used for the KPI rows across the feature. */
export default function StatCard({ label, value, helper, help, color, icon }: StatCardProps) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>
              {label}
            </Typography>
            {help && (
              <Tooltip title={help} arrow>
                <InfoOutlined sx={{ fontSize: 14, color: 'text.disabled' }} />
              </Tooltip>
            )}
          </Box>
          {icon && <Box sx={{ color: 'text.disabled', display: 'flex' }}>{icon}</Box>}
        </Box>
        <Typography
          variant="h4"
          component="p"
          sx={{ color: color ?? 'text.primary', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </Typography>
        {helper && (
          <Typography variant="caption" color="text.secondary" component="div">
            {helper}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
