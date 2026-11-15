import type { LucideIcon } from "lucide-react";

/**
 * The shared body of the error and not-found pages: a framed icon, a line in
 * the product's voice, one paragraph of explanation and the way out.
 * `fullPage` renders the standalone `<main>` used outside the app shell.
 */
export function Boundary({
  fullPage = false,
  icon: Icon,
  title,
  description,
  actions,
}: {
  fullPage?: boolean;
  icon: LucideIcon;
  title: React.ReactNode;
  description: React.ReactNode;
  actions: React.ReactNode;
}) {
  const Wrapper = fullPage ? "main" : "div";
  return (
    <Wrapper
      className={
        fullPage
          ? "flex min-h-svh w-full flex-col items-center justify-center px-4 py-16 text-center"
          : "flex flex-col items-center px-4 py-16 text-center"
      }
    >
      <div className="frame mb-5 flex h-14 w-14 items-center justify-center">
        <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <h1 className="t-voice-lg">{title}</h1>
      <p className="t-meta mx-auto mt-3 max-w-[46ch]">{description}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-2.5">{actions}</div>
    </Wrapper>
  );
}
