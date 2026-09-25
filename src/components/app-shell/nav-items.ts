import { Settings, Sun, type LucideIcon } from 'lucide-react';

export const NAV_ITEMS: readonly { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Bugün', icon: Sun },
  { href: '/ayarlar', label: 'Ayarlar', icon: Settings },
];
