import MuteToggle from "./MuteToggle";
import SignInPill from "./SignInPill";

export default function TopStrip() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between px-5 pt-5">
      <div className="pl-14" />
      <div className="pointer-events-auto flex items-center gap-3">
        <MuteToggle />
        <SignInPill />
      </div>
    </header>
  );
}
