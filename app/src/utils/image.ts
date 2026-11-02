/** Read a picked image, downscale it on a canvas and return a JPEG data URL (kept on this device only). */
export function fileToDataUrl(f: File, max = 720, q = 0.82): Promise<string> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      res(c.toDataURL('image/jpeg', q))
    }
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')) }
    img.src = url
  })
}
