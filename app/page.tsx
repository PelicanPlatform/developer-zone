import {
  Bolt,
  BugReport,
  Flag,
  Assessment,
  Groups,
  MergeType,
  Timer,
  ArrowForward,
} from "@mui/icons-material";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Link,
  Stack,
  Typography,
} from "@mui/material";

interface Breakdown {
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
  status: "live" | "planned";
}

const breakdowns: Breakdown[] = [
  {
    title: "Workflows",
    description:
      "Health and runtime metrics for the GitHub Actions workflows — pass rates, average runtimes, and flakiness across the default branch, pull requests, and external forks.",
    icon: <Bolt fontSize="large" />,
    href: "/flakiness",
    status: "live",
  },
  {
    title: "Test Failures",
    description:
      "Failed tests across the macOS, Windows, and Linux test workflows, aggregated from JUnit artifacts to surface flaky tests.",
    icon: <BugReport fontSize="large" />,
    href: "/test-failures",
    status: "live",
  },
  {
    title: "Milestones",
    description:
      "A zoomable timeline for each milestone — one segment per issue, from the day it was created to the day it was completed.",
    icon: <Flag fontSize="large" />,
    href: "/milestones",
    status: "live",
  },
  {
    title: "Developers",
    description:
      "A per-developer productivity breakdown — commits, line churn, pull requests, issues, streaks, and a year of activity, ranked across the team.",
    icon: <Groups fontSize="large" />,
    href: "/developers",
    status: "live",
  },
  {
    title: "Reporting",
    description:
      "Monthly report of enhancements delivered, stale open tickets, test coverage, and facilitation work closed — one row per month.",
    icon: <Assessment fontSize="large" />,
    href: "/reporting",
    status: "live",
  },
  {
    title: "PR Throughput",
    description:
      "Review latency, time-to-merge, and open pull-request backlog over time.",
    icon: <MergeType fontSize="large" />,
    status: "planned",
  },
  {
    title: "Build Duration",
    description:
      "How long CI takes per workflow and where the wall-clock time is spent.",
    icon: <Timer fontSize="large" />,
    status: "planned",
  },
];

export default function Home() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Box sx={{ maxWidth: 760, mb: 6 }}>
          <Typography
            variant="overline"
            sx={{ color: "primary.main", fontWeight: 600, letterSpacing: 1 }}
          >
            Pelican Platform
          </Typography>
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
            Dev Zone
          </Typography>
          <Typography variant="h6" component="p" color="text.secondary">
            Engineering dashboards that break down the health of the{" "}
            <Link
              href="https://github.com/PelicanPlatform/pelican"
              target="_blank"
              rel="noopener noreferrer"
            >
              PelicanPlatform/pelican
            </Link>{" "}
            codebase — CI reliability, delivery speed, and more, pulled live from
            GitHub.
          </Typography>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
              md: "repeat(3, 1fr)",
            },
            gap: 3,
          }}
        >
          {breakdowns.map((b) => (
            <BreakdownCard key={b.title} breakdown={b} />
          ))}
        </Box>
      </Container>
    </Box>
  );
}

function BreakdownCard({ breakdown }: { breakdown: Breakdown }) {
  const isLive = breakdown.status === "live";

  const inner = (
    <CardContent sx={{ height: "100%" }}>
      <Stack spacing={2} sx={{ height: "100%" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ color: isLive ? "primary.main" : "text.disabled" }}>
            {breakdown.icon}
          </Box>
          <Chip
            label={isLive ? "Live" : "Planned"}
            size="small"
            color={isLive ? "primary" : "default"}
            variant={isLive ? "filled" : "outlined"}
          />
        </Box>
        <Typography variant="h6" component="h2">
          {breakdown.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
          {breakdown.description}
        </Typography>
        {isLive && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              color: "primary.main",
              fontWeight: 600,
            }}
          >
            <Typography variant="button">View dashboard</Typography>
            <ArrowForward fontSize="small" />
          </Box>
        )}
      </Stack>
    </CardContent>
  );

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        opacity: isLive ? 1 : 0.7,
        transition: "border-color 0.2s, box-shadow 0.2s",
        ...(isLive && {
          "&:hover": { borderColor: "primary.main", boxShadow: 3 },
        }),
      }}
    >
      {isLive && breakdown.href ? (
        <CardActionArea
          component={Link}
          href={breakdown.href}
          sx={{ height: "100%" }}
        >
          {inner}
        </CardActionArea>
      ) : (
        inner
      )}
    </Card>
  );
}
