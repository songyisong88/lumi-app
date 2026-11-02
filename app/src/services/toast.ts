/** Fire-and-forget toast. Rendered by <Toaster/> in App. */
export function toast(text: string) {
  window.dispatchEvent(new CustomEvent('lumi-toast', { detail: text }))
}
