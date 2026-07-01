import { Box, Container, Link, Typography } from '@mui/material';

const Footer = () => (
	<Box
		component="footer"
		sx={{
			mt: 10,
			py: 4,
			bgcolor: 'primary.dark',
			color: 'primary.contrastText',
		}}
	>
		<Container
			maxWidth="lg"
			sx={{
				display: 'flex',
				flexDirection: { xs: 'column', sm: 'row' },
				justifyContent: 'space-between',
				alignItems: { sm: 'center' },
				gap: 2,
			}}
		>
			<Typography variant="body2">
				Pelican Dev Zone — engineering dashboards for the Pelican Platform.
			</Typography>
			<Box sx={{ display: 'flex', gap: 3 }}>
				<Link
					href="https://pelicanplatform.org"
					target="_blank"
					rel="noopener noreferrer"
					color="inherit"
					underline="hover"
				>
					pelicanplatform.org
				</Link>
				<Link
					href="https://github.com/PelicanPlatform/pelican"
					target="_blank"
					rel="noopener noreferrer"
					color="inherit"
					underline="hover"
				>
					GitHub
				</Link>
			</Box>
		</Container>
	</Box>
);

export default Footer;
