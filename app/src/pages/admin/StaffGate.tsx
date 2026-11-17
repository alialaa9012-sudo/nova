import { Lock, Mail } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { BandHeader, BandSheet } from '@/components/BandHeader'
import { IconField } from '@/components/IconField'
import { fieldGroup, rowInput } from '@/components/form-styles'
import { Button } from '@/components/ui/button'
import { api, errorMessage } from '@/lib/api'
import { fieldProps } from '@/lib/a11y'

/**
 * Shows the staff screens only to a signed-in staff member. On the local demo there is no sign-in
 * (api.auth is missing), so the board stays open there.
 */
export function StaffGate({ children }: { children: ReactNode }) {
  const auth = api.auth
  // undefined = still checking, null = signed out
  const [session, setSession] = useState<{ email: string } | null | undefined>(auth ? undefined : { email: '' })

  useEffect(() => {
    if (!auth) return
    let live = true
    void auth.getSession().then((s) => live && setSession(s)).catch(() => live && setSession(null))
    const stop = auth.onChange((s) => live && setSession(s))
    return () => {
      live = false
      stop()
    }
  }, [auth])

  if (session === undefined) {
    return (
      <p role="status" className="p-10 text-center font-semibold text-muted-foreground">
        جارٍ التحميل…
      </p>
    )
  }
  return session ? children : <StaffLogin />
}

function StaffLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return setError('اكتب الإيميل وكلمة المرور.')
    setBusy(true)
    setError('')
    try {
      await api.auth?.signIn(email, password)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <title>دخول الموظفين | خليها مشاوي</title>
      <BandHeader backTo="/" backLabel="الصفحة الرئيسية">
        <h1 className="mt-6 text-[28px] leading-10 font-extrabold lg:text-[32px] lg:leading-[44px]">دخول الموظفين</h1>
        <p className="mt-1 text-sm leading-[22px] text-band-muted">للكول سنتر والفروع فقط.</p>
      </BandHeader>
      <BandSheet className="pt-4 pb-12">
        <form onSubmit={submit} noValidate className="mx-auto grid max-w-md gap-4">
          <div className={fieldGroup}>
            <IconField id="login-email" label="الإيميل" icon={Mail}>
              <input {...fieldProps('login-email')} type="email" dir="ltr" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={rowInput} />
            </IconField>
            <IconField id="login-password" label="كلمة المرور" icon={Lock}>
              <input {...fieldProps('login-password')} type="password" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={rowInput} />
            </IconField>
          </div>
          {error ? (
            <p role="alert" className="rounded-2xl bg-danger-soft p-3 text-sm font-semibold text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={busy} className="h-13 text-base font-extrabold">
            {busy ? 'جارٍ الدخول…' : 'دخول'}
          </Button>
        </form>
      </BandSheet>
    </>
  )
}
