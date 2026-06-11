import Link from "next/link";
import {
  type ContentItem,
  formatPostDate,
  getCategoryDisplayName,
} from "~/lib/content";
import { TOPICS } from "~/lib/topics";
import { uploadsUrl } from "~/lib/uploads";

const TONES = [
  { bg: "#D6E5D3", fg: "#7A9E7E" }, // green
  { bg: "#ECDEDA", fg: "#C9857A" }, // rose
  { bg: "#EDE8D8", fg: "#9A8C60" }, // gold
  { bg: "#D8E4EC", fg: "#5A849E" }, // blue
];

function toneFor(post: ContentItem, index: number) {
  const slug = post.categories?.[0];
  const topicIndex = slug ? TOPICS.findIndex((t) => t.slug === slug) : -1;
  return TONES[(topicIndex >= 0 ? topicIndex : index) % TONES.length]!;
}

function primaryCategory(post: ContentItem): string | undefined {
  return post.categories?.[0];
}

/** Decorative leaf used inside image placeholders. */
function LeafMark({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M16 4 C16 4 6 10 6 18 C6 23.5 10.5 28 16 28 C21.5 28 26 23.5 26 18 C26 10 16 4 16 4Z"
        stroke={color}
        strokeWidth="1.2"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M16 10 C16 10 11 14 11 18 C11 20.8 13.2 23 16 23"
        stroke={color}
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Large hero treatment for the most recent post. */
export function FeaturedPost({ post }: { post: ContentItem }) {
  const tone = toneFor(post, 0);
  const cover = uploadsUrl(post.cover);
  const cat = primaryCategory(post);

  return (
    <article className="mb-10 border-b border-gms-line pb-10">
      <p className="m-0 mb-6 text-[10px] font-bold tracking-[0.2em] text-gms-rose uppercase">
        Latest post
      </p>
      <Link href={`/${post.slug}/`} className="group block">
        <div
          className="mb-5 flex h-[220px] items-center justify-center overflow-hidden rounded-md"
          style={{ background: tone.bg }}
        >
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt={post.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <span className="opacity-60">
              <LeafMark color={tone.fg} />
            </span>
          )}
        </div>
        {cat && (
          <p
            className="m-0 mb-2 text-[10px] font-bold tracking-[0.18em] uppercase"
            style={{ color: tone.fg }}
          >
            {getCategoryDisplayName(cat)}
          </p>
        )}
        <h2 className="m-0 mb-3 font-serif text-[26px] leading-[1.25] font-semibold text-gms-ink group-hover:text-gms-stone">
          {post.title}
        </h2>
        <p className="m-0 mb-3 text-[12px] font-light tracking-[0.04em] text-gms-muted">
          {formatPostDate(post.date)}
        </p>
      </Link>
      {post.excerpt && (
        <p className="m-0 mb-4 text-[15px] leading-[1.75] text-gms-stone">
          {post.excerpt}
        </p>
      )}
      <Link
        href={`/${post.slug}/`}
        className="border-b-[1.5px] border-gms-rose pb-px text-[12px] font-bold tracking-[0.1em] text-gms-rose uppercase"
      >
        Read more →
      </Link>
    </article>
  );
}

/** Compact card used in grids and category listings. */
export function PostCard({
  post,
  index = 0,
}: {
  post: ContentItem;
  index?: number;
}) {
  const tone = toneFor(post, index);
  const cover = uploadsUrl(post.cover);
  const cat = primaryCategory(post);

  return (
    <article>
      <Link href={`/${post.slug}/`} className="group block">
        <div
          className="mb-3 flex h-[130px] items-center justify-center overflow-hidden rounded-md text-[11px] tracking-[0.04em]"
          style={{ background: tone.bg, color: tone.fg }}
        >
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt={post.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <span className="opacity-70">
              <LeafMark color={tone.fg} />
            </span>
          )}
        </div>
        {cat && (
          <p
            className="m-0 mb-2 text-[10px] font-bold tracking-[0.18em] uppercase"
            style={{ color: tone.fg }}
          >
            {getCategoryDisplayName(cat)}
          </p>
        )}
        <h3 className="m-0 mb-2 font-serif text-[19px] leading-[1.3] font-semibold text-gms-ink group-hover:text-gms-stone">
          {post.title}
        </h3>
        <p className="m-0 mb-2 text-[12px] font-light tracking-[0.04em] text-gms-muted">
          {formatPostDate(post.date)}
        </p>
        <span className="border-b-[1.5px] border-gms-rose pb-px text-[12px] font-bold tracking-[0.1em] text-gms-rose uppercase">
          Read →
        </span>
      </Link>
    </article>
  );
}
