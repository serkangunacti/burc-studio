import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Particles } from '@/components/ui/particles';
import { ShineBorder } from '@/components/ui/shine-border';
import { safeNextPath } from '@/lib/auth/redirect';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Giriş' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
      <Particles className="absolute inset-0" quantity={90} ease={80} color="#b79bd9" />
      <Card className="relative w-full max-w-sm overflow-hidden">
        <ShineBorder shineColor={['#c8b6e2', '#f4c2c2', '#bfd7ed']} />
        <CardHeader>
          <CardTitle className="font-heading text-3xl">kozmikarkan</CardTitle>
          <CardDescription>Devam etmek için şifreni gir.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={safeNextPath(typeof next === 'string' ? next : null)} />
        </CardContent>
      </Card>
    </main>
  );
}
