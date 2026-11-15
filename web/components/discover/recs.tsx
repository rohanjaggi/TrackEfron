import Link from "next/link";
import { RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LoadingLine, MediaGridSkeleton } from "@/components/ui/loading";
import { EmptyState, Notice, SectionHeader } from "@/components/ui/page";
import { LOG_HREF, PROFILE_HREF, type RecsProblem } from "./types";

const NOT_ENOUGH_LOGS_COPY = "Log and rate at least 5 titles to get recommendations.";
const RECS_ERROR_COPY = "Couldn't build recommendations. Try again.";

/** The way forward wherever an AI feature has no key to run on. */
function AiKeyLink() {
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={PROFILE_HREF}>Add a key in your profile</Link>
    </Button>
  );
}

// ─── For you pieces ───

/**
 * Why a For you section has nothing new to show. On its own it fills the section;
 * `withPicks` is the failed-refresh case, shown above the picks that stay on screen.
 */
function RecsProblemView({
  problem,
  domain,
  withPicks = false,
  onRetry,
}: {
  problem: RecsProblem;
  domain: "film" | "music";
  withPicks?: boolean;
  onRetry: () => void;
}) {
  if (problem.kind === "no_key") {
    return withPicks ? (
      <Notice tone="error" title="Couldn't refresh your picks" action={<AiKeyLink />} className="mb-6">
        Recommendations need an AI key, and none is saved. The picks below are from before.
      </Notice>
    ) : (
      <div className="frame">
        <EmptyState
          icon={Sparkles}
          title="Recommendations need an AI key."
          description="These picks are written using your own AI key, and none is saved yet. Add one in your profile and they will appear here."
          action={<AiKeyLink />}
        />
      </div>
    );
  }

  if (problem.kind === "not_enough_logs") {
    return (
      <div className="frame">
        <EmptyState
          icon={Sparkles}
          title={NOT_ENOUGH_LOGS_COPY}
          description="We need a few more ratings to learn your taste. Keep logging."
          action={
            <Button asChild variant="outline">
              <Link href={LOG_HREF}>{domain === "music" ? "Log a listen" : "Log a watch"}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <Notice
      tone="error"
      title={RECS_ERROR_COPY}
      className={withPicks ? "mb-6" : undefined}
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    >
      {(problem.detail || withPicks) && (
        <>
          {problem.detail && <p className="t-meta">{problem.detail}</p>}
          {withPicks && <p className={problem.detail ? "mt-1" : undefined}>The picks below are from before.</p>}
        </>
      )}
    </Notice>
  );
}

/** A For you section's header with Refresh, then its picks, its loading state, or why there are none. */
export function PicksSection({
  title,
  note,
  domain,
  recs,
  onRefresh,
  children,
}: {
  title: string;
  note: string;
  domain: "film" | "music";
  recs: { loading: boolean; problem: RecsProblem | null; count: number };
  /** Asks for a rebuild: used by Refresh and by Try again, since an empty answer is cached. */
  onRefresh: () => void;
  /** The grid of picks. */
  children: React.ReactNode;
}) {
  const { loading, problem, count } = recs;
  return (
    <>
      <SectionHeader
        title={title}
        className="mb-3"
        meta={!loading && count > 0 ? `${count} picks` : undefined}
        action={
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw aria-hidden="true" />
            {loading ? "Refreshing" : "Refresh"}
          </Button>
        }
      />
      <p className="t-meta mb-5">{note}</p>

      {count > 0 ? (
        <>
          {problem && !loading && (
            <RecsProblemView problem={problem} domain={domain} withPicks onRetry={onRefresh} />
          )}
          {children}
        </>
      ) : loading ? (
        <>
          <LoadingLine label="Finding picks for you" className="mb-5" />
          <MediaGridSkeleton count={10} aspect={domain === "music" ? "square" : "poster"} />
        </>
      ) : problem ? (
        <RecsProblemView problem={problem} domain={domain} onRetry={onRefresh} />
      ) : null}
    </>
  );
}
