import type { Metadata } from 'next'
import Link from 'next/link'
import { VoraLogo } from '@/components/vora/vora-logo'

export const metadata: Metadata = {
  title: 'Your privacy — VORA',
  description: 'How the VORA MVP handles photos, measurements and usage information.',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground sm:px-10 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-center justify-between gap-6 border-b border-foreground/15 pb-6">
          <VoraLogo className="h-8 w-auto" />
          <Link href="/" className="text-xs tracking-wide underline underline-offset-4 focus-visible:outline focus-visible:outline-offset-4">
            Back to VORA
          </Link>
        </header>
        <p className="mt-12 text-[10px] uppercase tracking-[0.3em] text-foreground/55">Privacy in the MVP</p>
        <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">Your photos.<br />Your privacy.</h1>
        <p className="mt-6 max-w-lg text-sm leading-7 text-foreground/70">
          This notice explains how VORA&apos;s body analysis app currently handles your information.
        </p>
        <div className="mt-10 space-y-9 text-sm leading-7 text-foreground/70">
          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">Photos and camera</h2>
            <p>Your photos and camera frames are analysed on your device. VORA does not upload them to its servers, keep a photo database, or use your photos to train an algorithm. Photos remain temporarily in your browser while you use the analysis flow.</p>
            <p className="mt-3">Camera access starts only when you choose the camera option and allow your browser to use it. You can close the camera or use the measurements option instead.</p>
          </section>
          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">Measurements and email</h2>
            <p>The MVP uses the measurements you enter to calculate your styling profile in your browser. When email registration is unavailable, you can view your results without providing an email. When the email form is available and you submit it, VORA saves your email, registration date, app source and a request ID in a private Google Sheet, using Google Apps Script. These records let the VORA team keep its list of leads. We do not send result emails.</p>
            <p className="mt-3">Your photos, measurements and body analysis are not included in this registration. Only the VORA team and authorised collaborators can access the sheet. You can contact VORA to request removal of your email.</p>
          </section>
          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">Visits and technical services</h2>
            <p>The app includes Vercel Web Analytics for usage statistics. When enabled, it can collect information such as visited pages, browser, device type and approximate location. This is separate from photo analysis.</p>
            <p className="mt-3">Our hosting and the services that deliver the analysis software receive ordinary web requests when the app loads. Those requests do not include your photos. A browser session setting remembers whether you have already seen the welcome animation.</p>
            <a href="https://vercel.com/docs/analytics/privacy-policy" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-foreground underline underline-offset-4">Read about Vercel Web Analytics privacy</a>
          </section>
          <section className="border-t border-foreground/15 pt-8">
            <h2 className="mb-3 text-base font-semibold text-foreground">Questions about your information?</h2>
            <p>Grecia coordinates VORA. You can contact the team through our official account for questions about this MVP and the information you provide.</p>
            <a href="https://www.instagram.com/vorastyling/" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center border border-foreground/30 px-5 text-xs uppercase tracking-[0.15em] text-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline focus-visible:outline-offset-4">Contact VORA</a>
          </section>
        </div>
      </div>
    </main>
  )
}
