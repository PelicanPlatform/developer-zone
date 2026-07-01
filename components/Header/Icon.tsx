import PelicanLogo from "@/public/logos/pelican.png";
import React, {CSSProperties} from "react";

const Icon = ({size = "44px"}: {size?: CSSProperties['height']}) => {

	const style = {
		height: size,
		width: "auto",
	}

	return (
		<img
			src={PelicanLogo.src}
			alt="Pelican Platform logo"
			style={style}
		/>
	)
}

export default Icon;
