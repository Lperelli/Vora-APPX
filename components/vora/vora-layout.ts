/**
 * Shared content width for dark VORA flows (results, processing, upload, etc.).
 * Mobile stays readable; desktop opens to ~896–1152px so stacked cards / 4-col grids don’t feel cramped.
 */
export const VORA_FLOW_MAX =
  'w-full max-w-xl mx-auto sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl'

/** Photo flip panel: same scale so it lines up with Final Review below. */
export const VORA_UPLOAD_PANEL_MAX =
  'w-full max-w-xl mx-auto sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl'

/** Results screen column width (Figma Frame 98). */
export const VORA_RESULTS_MAX = 'w-full max-w-[545px] mx-auto'

/** Measurements quiz: form column (Figma Frame 49, 348px). */
export const VORA_MEASUREMENTS_FORM_MAX = 'w-full max-w-[348px]'
