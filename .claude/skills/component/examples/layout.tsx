import Link from "next/link";

type ProfileLayoutProps = {
  children: React.ReactNode;
};

export default function ProfileLayout({ children }: ProfileLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <nav className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-6 p-4">
          <Link href="/profile" className="font-semibold">
            profile
          </Link>
          <Link href="/profile/portfolio" className="text-neutral-600 hover:text-neutral-900">
            portfolio
          </Link>
          <Link href="/profile/history" className="text-neutral-600 hover:text-neutral-900">
            history
          </Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
