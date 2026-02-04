import { AuthButton } from "@/components/auth-button";
import Link from "next/link";
import { Suspense } from "react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-1 w-full flex flex-col">
        <nav className="w-full flex justify-center border-b border-border h-16 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="w-full max-w-6xl flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex items-center font-bold text-lg">
              <Link href="/protected" className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                TrackEfron
              </Link>
            </div>
            <Suspense>
              <AuthButton />
            </Suspense>
          </div>
        </nav>
        <div className="flex-1 flex flex-col max-w-6xl mx-auto p-5 w-full">
          {children}
        </div>

        <footer className="w-full flex items-center justify-center border-t border-border mx-auto text-center text-xs gap-8 py-8 text-muted-foreground">
          <p>© 2024 TrackEfron. Track your story.</p>
        </footer>
      </div>
    </main>
  );
}
