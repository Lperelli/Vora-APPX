'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { VoraLogo } from './vora-logo'
import { ScreenReturnButton } from './screen-return-button'

export const FIGMA_FLOW_BUTTON =
  'flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[#2c2c2c] bg-[#1e1e1e] px-6 py-2 text-[10px] font-medium uppercase leading-5 tracking-[2px] text-white transition-colors hover:bg-[#282828] disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white'

export function FigmaFlowHeader({
  onReturn,
  returnLabel = 'Return',
}: {
  onReturn: () => void
  returnLabel?: string
}) {
  return (
    <header className="grid h-[104px] shrink-0 grid-cols-[1fr_101px_1fr] items-start px-6 pt-8 md:h-[128px] md:px-[6.875%] md:pt-[50px]">
      <ScreenReturnButton
        onClick={onReturn}
        label={returnLabel}
        variant="onDark"
        className="!justify-start !text-[12px] !tracking-[2px] !text-[#d1d5dc]"
      />
      <div className="pt-[10px]">
        <VoraLogo design="figma" />
      </div>
      <span aria-hidden />
    </header>
  )
}

export function FigmaPrivacyFooter() {
  return (
    <footer className="mt-auto shrink-0 px-5 pb-7 pt-8 text-center text-[10px] font-medium uppercase leading-5 tracking-[2px] text-[#ababab] md:pb-[41px] md:pt-0">
      <Link href="/privacy" className="underline-offset-4 hover:underline">
        Privacy first / Processed locally, never stored
      </Link>
    </footer>
  )
}

export function FigmaFlowShell({
  onReturn,
  children,
  nodeId,
}: {
  onReturn: () => void
  children: ReactNode
  nodeId?: string
}) {
  return (
    <div
      data-node-id={nodeId}
      className="flex min-h-dvh flex-col bg-[#101010] font-sans text-[#d1d5dc] md:min-h-[max(755px,100dvh)]"
    >
      <FigmaFlowHeader onReturn={onReturn} />
      {children}
      <FigmaPrivacyFooter />
    </div>
  )
}
