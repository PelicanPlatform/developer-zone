import type { Metadata } from "next";

import {Box} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { Dashboard, Bolt, BugReport, Flag } from '@mui/icons-material';

import theme, {fonts} from "@chtc/web-components/themes/pelican"

import "./globals.css"
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Analytics from "@/components/Analytics";

export const metadata: Metadata = {
  title: "Pelican Dev Zone",
  description: "Engineering dashboards visualizing the health of the Pelican Platform codebase.",
	metadataBase: new URL(`https://${process.env.HOSTNAME}`),
	// Keep the site out of search indexes. Inherited by every page, so each route
	// emits <meta name="robots" content="noindex, nofollow">. Crawling stays
	// allowed in robots.txt so bots can actually read this directive.
	robots: { index: false, follow: false },
};

const pages = [
	{ label: 'Overview', path: '/', icon: <Dashboard /> },
	{ label: 'CI Flakiness', path: '/flakiness', icon: <Bolt /> },
	{ label: 'Test Failures', path: '/test-failures', icon: <BugReport /> },
	{ label: 'Milestones', path: '/milestones', icon: <Flag /> },
]

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fonts.map(font => font.className).join(' ')}>
			{ process.env.NEXT_PUBLIC_MATOMO_URL && process.env.NEXT_PUBLIC_MATOMO_SITE_ID &&
				<Analytics url={process.env.NEXT_PUBLIC_MATOMO_URL} siteId={process.env.NEXT_PUBLIC_MATOMO_SITE_ID} />
			}
      <AppRouterCacheProvider>
        <Box component={"body"} sx={{ margin: 0, padding: 0 }}>
          <ThemeProvider theme={theme}>
						<Header pages={pages} />
						{children}
            <Footer />
          </ThemeProvider>
        </Box>
      </AppRouterCacheProvider>
    </html>
  );
}
