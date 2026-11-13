/**
 * A template re-mounts on every navigation, so each route's content opens
 * with the shutter cut while the nav above it stays perfectly still.
 */
export default function ProtectedTemplate({ children }: { children: React.ReactNode }) {
  return <div className="shutter-in">{children}</div>;
}
