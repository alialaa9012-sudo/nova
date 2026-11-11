import { useState } from 'react'
import { Minus, Plus, ShoppingCart, Store } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const branches = [
  { code: 'A', name: 'فرع العاشر من رمضان' },
  { code: 'Z', name: 'فرع الزقازيق' },
  { code: 'T', name: 'فرع التجمع الخامس' },
]

function App() {
  const [quantity, setQuantity] = useState(0)

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 p-4">
      <header className="flex items-center gap-2">
        <Store className="size-6" aria-hidden="true" />
        <h1 className="text-xl font-bold">طلبات المطعم</h1>
        <Badge variant="secondary" className="ms-auto">
          نسخة تجريبية
        </Badge>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>اختر الفرع</CardTitle>
          <CardDescription>
            تظهر لك قائمة الطعام والأسعار الخاصة بالفرع الذي تختاره.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {branches.map((branch) => (
            <Button
              key={branch.code}
              type="button"
              variant="outline"
              size="lg"
              className="justify-start"
            >
              {branch.name}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>السلة</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="تقليل الكمية"
            onClick={() => setQuantity((q) => Math.max(0, q - 1))}
          >
            <Minus aria-hidden="true" />
          </Button>
          <span
            className="min-w-6 text-center text-lg font-semibold tabular-nums"
            aria-live="polite"
            data-testid="quantity"
          >
            {quantity}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="زيادة الكمية"
            onClick={() => setQuantity((q) => q + 1)}
          >
            <Plus aria-hidden="true" />
          </Button>
          <Button type="button" className="ms-auto">
            <ShoppingCart data-icon="inline-start" aria-hidden="true" />
            إتمام الطلب
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}

export default App
