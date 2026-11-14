import { Link } from 'react-router'
import { SiteHeader } from '@/components/SiteHeader'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <>
      <title>الصفحة غير موجودة | خليها مشاوي</title>
      <SiteHeader logo />
      <main className="mx-auto grid max-w-3xl gap-4 px-5 py-12 text-center">
        <h1 className="text-2xl font-bold">الصفحة غير موجودة</h1>
        <p className="text-muted-foreground">ربما تغيّر الرابط. ابدأ من اختيار الفرع.</p>
        <Button asChild size="lg" className="mx-auto">
          <Link to="/">اختيار الفرع</Link>
        </Button>
      </main>
    </>
  )
}
