import { createLeadHandler, createLeadStatusHandler } from '@/lib/lead-handler'

export const dynamic = 'force-dynamic'

export const POST = createLeadHandler()
export const GET = createLeadStatusHandler()
