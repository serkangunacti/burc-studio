import { Archive, Settings, Stars, Sun, type LucideIcon } from 'lucide-react';

export const NAV_ITEMS: readonly { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Bugün', icon: Sun },
  { href: '/burclar', label: 'Burçlar', icon: Stars },
  { href: '/arsiv', label: 'Arşiv', icon: Archive },
  { href: '/ayarlar', label: 'Ayarlar', icon: Settings },
];
