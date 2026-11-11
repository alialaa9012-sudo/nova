import { MapPin, MessageCircle, Phone, Search } from 'lucide-react'
import { Link } from 'react-router'
import { OpenBadge } from '@/components/OpenBadge'
import { SiteHeader } from '@/components/SiteHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useNow } from '@/hooks/useNow'
import { brand, branches, type Branch } from '@/lib/catalog'
import { summarizeHours } from '@/lib/hours'
import { lastOrder } from '@/lib/lastOrder'

function BranchCard({ branch, now }: { branch: Branch; now: Date }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          <h2>فرع {branch.name}</h2>
        </CardTitle>
        <CardDescription>{branch.address}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <OpenBadge branch={branch} now={now} />
        <ul className="grid gap-0.5 text-sm">
          {summarizeHours(branch.hours).map((h) => (
            <li key={h.days}>
              <span className="font-semibold">{h.days}:</span> {h.text}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg" className="h-12 flex-1 text-base">
            <Link to={`/branch/${branch.id}`}>اطلب من فرع {branch.name}</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12">
            <a href={`tel:${branch.phones[0]}`}>
              <Phone aria-hidden="true" /> اتصال
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12">
            <a href={branch.mapsUrl} target="_blank" rel="noopener noreferrer">
              <MapPin aria-hidden="true" /> الموقع
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function HomePage() {
  const now = useNow()
  const previous = lastOrder()
  return (
    <>
      <title>خليها مشاوي | اطلب أونلاين</title>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-2xl font-extrabold">اطلب من خليها مشاوي</h1>
        <p className="mt-1 text-muted-foreground">اختر الفرع الأقرب لك لتظهر قائمة طعامه وأسعاره ومناطق توصيله.</p>
        <ul className="mt-6 grid gap-4">
          {branches.map((b) => (
            <li key={b.id}>
              <BranchCard branch={b} now={now} />
            </li>
          ))}
        </ul>
        <section aria-labelledby="help-title" className="mt-8 grid gap-3 rounded-xl border bg-card p-4">
          <h2 id="help-title" className="font-bold">
            طلبت قبل كده؟
          </h2>
          <div className="flex flex-wrap gap-2">
            {previous ? (
              <Button asChild size="lg" className="h-12">
                <Link to={`/order/${previous.number}`} state={{ phone: previous.phone }}>
                  حالة طلبك {previous.number}
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="lg" className="h-12">
              <Link to="/track">
                <Search aria-hidden="true" /> تتبع طلب
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12">
              <a href={brand.whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" /> واتساب <span dir="ltr">{brand.whatsappNumber}</span>
              </a>
            </Button>
          </div>
        </section>
      </main>
      <footer className="mx-auto max-w-3xl px-4 pb-8 text-center text-sm text-muted-foreground">الدفع كاش عند الاستلام.</footer>
    </>
  )
}
