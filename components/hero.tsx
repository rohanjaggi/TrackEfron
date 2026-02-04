export function Hero() {
  return (
    <div className="flex flex-col gap-12 items-center text-center">
      <div className="space-y-4">
        <h1 className="text-5xl lg:text-6xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
          TrackEfron
        </h1>
        <p className="text-xl text-muted-foreground">
          Track movies and TV shows you watch, write reviews, and discover what to watch next
        </p>
      </div>

      <div className="space-y-4 pt-4">
        <p className="text-foreground/80 max-w-2xl">
          Keep a personalized record of every movie and show you watch. Rate them, write reviews,
          and get AI-powered recommendations based on your taste.
        </p>
      </div>

      <div className="w-full p-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent my-4" />
    </div>
  );
}
