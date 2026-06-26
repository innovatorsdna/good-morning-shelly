import { type MetadataRoute } from "next";

/**
 * Web app manifest, served at `/manifest.webmanifest`.
 *
 * `start_url` / `scope` point at `/diary` so that when the site is installed
 * to an iPhone home screen (Share → "Add to Home Screen"), launching the icon
 * always opens the Love Diary as a full-screen, standalone app.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Good Morning Shelly",
    short_name: "Diary",
    description:
      "Personal blog about faith, family, nature, and morning moments.",
    start_url: "/diary/",
    scope: "/",
    display: "standalone",
    background_color: "#FAF7F2",
    theme_color: "#7A9E7E",
    icons: [
      {
        src: "/favicon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
      {
        src: "/apple-touch-icon.png",
        type: "image/png",
        sizes: "180x180",
        purpose: "any",
      },
    ],
  };
}
