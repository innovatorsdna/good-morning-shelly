export function SiteFooter() {
  return (
    <footer className="border-t border-gms-line px-4 py-8 text-center text-[12px] font-light tracking-[0.06em] text-gms-muted">
      <em className="font-serif text-gms-sage not-italic [font-style:italic]">
        Good Morning Shelly
      </em>{" "}
      &nbsp;·&nbsp; Made with love in Kansas &nbsp;·&nbsp; ©{" "}
      {new Date().getFullYear()}
    </footer>
  );
}
