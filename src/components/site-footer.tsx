export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-neutral-200">
      <div className="mx-auto max-w-3xl px-6 py-8 text-sm text-neutral-500">
        © {new Date().getFullYear()} Good Morning Shelly
      </div>
    </footer>
  );
}
