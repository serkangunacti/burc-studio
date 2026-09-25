import Link from 'next/link';
import { connection } from 'next/server';
import { BlurFade } from '@/components/ui/blur-fade';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateLongTr, istanbulDateKey } from '@/lib/date/istanbul';

export default async function TodayPage() {
  await connection();
  const today = istanbulDateKey();
  return (
    <section className="mx-auto max-w-3xl space-y-8">
      <BlurFade>
        <p className="text-sm text-muted-foreground">{formatDateLongTr(today)}</p>
        <h1 className="font-heading text-4xl">Bugün</h1>
      </BlurFade>
      <BlurFade delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle>Günün paketi</CardTitle>
            <CardDescription>
              Burç yorumu üretimi bir sonraki aşamada bu sayfaya eklenecek. Şimdilik ayarlarını hazırlayabilirsin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/ayarlar" className={buttonVariants({ variant: 'outline' })}>
              Ayarlara git
            </Link>
          </CardContent>
        </Card>
      </BlurFade>
    </section>
  );
}
