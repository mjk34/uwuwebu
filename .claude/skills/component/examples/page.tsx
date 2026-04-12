import { mockCurrentUser } from "@/lib/mock";

export default function ProfilePage() {
  const user = mockCurrentUser;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="flex items-center gap-4">
        <img
          src={user.avatarUrl}
          alt={`${user.username} avatar`}
          className="h-16 w-16 rounded-full"
        />
        <div>
          <h1 className="text-2xl font-semibold">{user.username}</h1>
          <p className="text-sm text-neutral-500">level {user.level}</p>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-4">
        <Stat label="uwu creds" value={user.creds.toLocaleString()} />
        <Stat label="xp" value={user.xp.toLocaleString()} />
        <Stat label="rolls" value={user.rolls} />
        <Stat label="tickets" value={user.tickets} />
      </section>
    </main>
  );
}

type StatProps = {
  label: string;
  value: string | number;
};

function Stat({ label, value }: StatProps) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-medium">{value}</p>
    </div>
  );
}
