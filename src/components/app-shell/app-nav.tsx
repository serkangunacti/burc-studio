'use client';

import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dock, DockIcon } from '@/components/ui/dock';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './nav-items';

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden border-r border-sidebar-border bg-sidebar p-6 md:flex md:min-h-dvh md:flex-col md:gap-8">
      <Link href="/" className="font-heading text-2xl">
        kozmikarkan
      </Link>
      <nav aria-label="Ana menü" className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(pathname, href) ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent',
              isActive(pathname, href) && 'bg-sidebar-accent font-semibold',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
      <form action="/api/auth/logout" method="post" className="mt-auto">
        <button
          type="submit"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="size-4" aria-hidden />
          Çıkış yap
        </button>
      </form>
    </aside>
  );
}

export function MobileDock() {
  const pathname = usePathname();
  return (
    <nav aria-label="Alt menü" className="fixed inset-x-0 bottom-4 z-50 flex justify-center md:hidden">
      <Dock direction="middle" className="mt-0 bg-card/90 shadow-lg">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <DockIcon key={href}>
            <Link
              href={href}
              aria-label={label}
              aria-current={isActive(pathname, href) ? 'page' : undefined}
              className={cn(
                'flex size-full items-center justify-center rounded-full',
                isActive(pathname, href) && 'bg-secondary',
              )}
            >
              <Icon className="size-5" aria-hidden />
            </Link>
          </DockIcon>
        ))}
        <DockIcon>
          <form action="/api/auth/logout" method="post" className="size-full">
            <button type="submit" aria-label="Çıkış yap" className="flex size-full items-center justify-center rounded-full">
              <LogOut className="size-5" aria-hidden />
            </button>
          </form>
        </DockIcon>
      </Dock>
    </nav>
  );
}
