import { AppSidebar, MobileDock } from '@/components/app-shell/app-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
      <AppSidebar />
      <main className="px-4 pt-8 pb-32 md:px-10 md:pb-12">{children}</main>
      <MobileDock />
    </div>
  );
}
