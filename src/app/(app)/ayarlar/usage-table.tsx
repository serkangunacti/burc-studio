import type { UsageRow } from '@/lib/content/runs';
import { formatDateShortTr } from '@/lib/date/istanbul';

export function UsageTable({ rows }: { rows: UsageRow[] }) {
  return (
    <table aria-label="Son 7 günün sağlayıcı kullanımı" className="w-full text-left text-sm">
      <thead className="text-muted-foreground">
        <tr>
          <th className="py-2 font-medium">Gün</th>
          <th className="py-2 font-medium">Sağlayıcı</th>
          <th className="py-2 font-medium">Başarılı</th>
          <th className="py-2 font-medium">Başarısız</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={4} className="py-3 text-muted-foreground">
              Henüz çağrı yok.
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={`${row.date}-${row.provider}`} className="border-t">
              <td className="py-2">{formatDateShortTr(row.date)}</td>
              <td className="py-2">{row.provider}</td>
              <td className="py-2">{row.ok}</td>
              <td className="py-2">{row.failed}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
