import Link from "next/link";
import { TOPICS } from "~/lib/topics";

const navLinks = [
  { label: "Home", href: "/" },
  ...TOPICS.map((t) => ({ label: t.label, href: `/category/${t.slug}/` })),
  { label: "About", href: "/about/" },
  { label: "Search", href: "/search/" },
];

export function SiteHeader() {
  return (
    <header className="border-gms-line border-b px-4 pt-10 pb-4 text-center">
      <p className="text-gms-sage m-0 mb-4 text-[13px] font-light tracking-[0.18em] uppercase">
        Faith · Family · Garden · Story
      </p>
      <h1 className="text-gms-ink m-0 mb-1 font-serif text-[42px] leading-[1.1] font-normal tracking-[0.01em]">
        <Link href="/">Good Morning Shelly</Link>
      </h1>

      <svg
        className="mx-auto my-3 block"
        width="260"
        height="42"
        viewBox="0 0 260 42"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <line
          x1="10"
          y1="21"
          x2="100"
          y2="21"
          stroke="#C9857A"
          strokeWidth="0.8"
          opacity="0.5"
        />
        <line
          x1="160"
          y1="21"
          x2="250"
          y2="21"
          stroke="#C9857A"
          strokeWidth="0.8"
          opacity="0.5"
        />
        <circle cx="130" cy="21" r="4" fill="#C9857A" opacity="0.7" />
        <circle
          cx="130"
          cy="21"
          r="7.5"
          stroke="#C9857A"
          strokeWidth="0.8"
          opacity="0.4"
        />
        <path
          d="M115 21 Q110 14 104 18"
          stroke="#7A9E7E"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse
          cx="102"
          cy="16"
          rx="5"
          ry="3"
          fill="#7A9E7E"
          opacity="0.6"
          transform="rotate(-30 102 16)"
        />
        <path
          d="M109 21 Q106 13 101 15"
          stroke="#7A9E7E"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse
          cx="99"
          cy="13"
          rx="4"
          ry="2.5"
          fill="#7A9E7E"
          opacity="0.45"
          transform="rotate(-50 99 13)"
        />
        <path
          d="M145 21 Q150 14 156 18"
          stroke="#7A9E7E"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse
          cx="158"
          cy="16"
          rx="5"
          ry="3"
          fill="#7A9E7E"
          opacity="0.6"
          transform="rotate(30 158 16)"
        />
        <path
          d="M151 21 Q154 13 159 15"
          stroke="#7A9E7E"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse
          cx="161"
          cy="13"
          rx="4"
          ry="2.5"
          fill="#7A9E7E"
          opacity="0.45"
          transform="rotate(50 161 13)"
        />
        <path
          d="M122 21 Q120 10 117 7"
          stroke="#7A9E7E"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse
          cx="115"
          cy="5"
          rx="3.5"
          ry="2"
          fill="#7A9E7E"
          opacity="0.5"
          transform="rotate(-20 115 5)"
        />
        <path
          d="M138 21 Q140 10 143 7"
          stroke="#7A9E7E"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse
          cx="145"
          cy="5"
          rx="3.5"
          ry="2"
          fill="#7A9E7E"
          opacity="0.5"
          transform="rotate(20 145 5)"
        />
        <path
          d="M122 21 Q118 30 114 33"
          stroke="#7A9E7E"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse
          cx="112"
          cy="35"
          rx="3.5"
          ry="2"
          fill="#7A9E7E"
          opacity="0.4"
          transform="rotate(15 112 35)"
        />
        <path
          d="M138 21 Q142 30 146 33"
          stroke="#7A9E7E"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse
          cx="148"
          cy="35"
          rx="3.5"
          ry="2"
          fill="#7A9E7E"
          opacity="0.4"
          transform="rotate(-15 148 35)"
        />
      </svg>

      <nav className="flex flex-wrap justify-center gap-x-8 gap-y-2 px-4 pt-4">
        {navLinks.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="text-gms-stone hover:border-gms-sage hover:text-gms-sage border-b-[1.5px] border-transparent pb-0.5 text-[11px] font-bold tracking-[0.14em] uppercase transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
