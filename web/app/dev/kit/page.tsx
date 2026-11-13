import { notFound } from "next/navigation";
import { ModeProvider } from "@/lib/mode-context";
import { Kit } from "./kit";

export const metadata = { title: "TrackEfron — Component kit" };

/** Living catalogue of the design system. Development only. */
export default function KitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <ModeProvider>
      <Kit />
    </ModeProvider>
  );
}
