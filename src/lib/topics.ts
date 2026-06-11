/**
 * Editorial "pillar" topics that anchor the Good Morning Shelly design.
 * `slug` maps to the real category slugs used across the content.
 */
export interface Topic {
  label: string;
  slug: string;
  /** Accent color token (matches the palette in globals.css). */
  color: string;
  blurb: string;
}

export const TOPICS: Topic[] = [
  {
    label: "Garden",
    slug: "nature",
    color: "#7a9e7e",
    blurb: "seeds, soil, seasons",
  },
  {
    label: "Family History",
    slug: "family-history",
    color: "#c9857a",
    blurb: "roots & stories",
  },
  {
    label: "Homeschool",
    slug: "home-school",
    color: "#b0986a",
    blurb: "learning at home",
  },
  {
    label: "Faith",
    slug: "faith",
    color: "#7a9ebf",
    blurb: "the gospel of Jesus Christ",
  },
];
