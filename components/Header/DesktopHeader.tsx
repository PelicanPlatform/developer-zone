'use client'

import Toolbar from "@mui/material/Toolbar";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Button from "@mui/material/Button";
import React from "react";

import Title from "@/components/Header/Title";
import {NavigationItem} from "@/components/Header";

const DesktopHeader = ({ pages }: { pages: NavigationItem[] }) => {
	return (
		<Toolbar disableGutters>
			<Box
				sx={{
					width: '100%',
					display: 'flex',
					alignItems: 'center',
					gap: 1,
				}}
			>
				{/* Left: title. Takes an equal flex share so the nav sits centered
				    across the full header width, and shrinks before the nav does. */}
				<Box sx={{ flex: '1 1 0', minWidth: 0, display: 'flex', justifyContent: 'flex-start' }}>
					<Title />
				</Box>

				{/* Center: nav — natural width, centered, never clipped. Buttons wrap
				    to a second row on the rare chance the labels outgrow the width. */}
				<Box
					sx={{
						flex: '0 1 auto',
						display: 'flex',
						justifyContent: 'center',
						flexWrap: 'wrap',
						rowGap: 0.5,
					}}
				>
					{pages
						.filter((p) => typeof p.path === 'string' && p.path.length > 0)
						.map(({ label, path }) => (
							<Link key={path} href={path} underline="none" sx={{ display: 'inline-flex' }}>
								<Button
									sx={{
										my: 2,
										px: 1.25,
										minWidth: 'auto',
										color: 'white',
										whiteSpace: 'nowrap',
									}}
								>
									{label}
								</Button>
							</Link>
						))}
				</Box>

				{/* Right: equal flex share to balance the left title and keep the nav centered. */}
				<Box sx={{ flex: '1 1 0' }} />
			</Box>
		</Toolbar>
	);
};

export default DesktopHeader;
