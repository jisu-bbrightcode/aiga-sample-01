import type { ImgHTMLAttributes } from "react";
import logoUrl from "./logo.svg?url";

export default function Logo({
  alt = "Product Builder",
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  return <img src={logoUrl} alt={alt} {...props} />;
}
