export interface PreparedPhoto {
  image: HTMLCanvasElement
  dispose: () => void
}

/** Use the browser's photo decoder, just like the preview, without ImageBitmap. */
export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  if (!file.size) throw new Error('Empty image')
  const url = URL.createObjectURL(file)
  const image = new Image()
  const canvas = document.createElement('canvas')
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => finish(new Error('Image decoding timed out')),
        15000
      )
      const finish = (error?: Error) => {
        clearTimeout(timer)
        image.onload = image.onerror = null
        if (error) reject(error)
        else resolve()
      }
      image.onload = () => finish()
      image.onerror = () =>
        finish(new Error('Image format could not be decoded'))
      image.src = url
    })
    if (!image.naturalWidth || !image.naturalHeight)
      throw new Error('Empty image dimensions')
    // Full frame, native orientation and aspect ratio; bound GPU memory for phone photos.
    const scale = Math.min(
      1,
      1600 / Math.max(image.naturalWidth, image.naturalHeight)
    )
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image canvas unavailable')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return {
      image: canvas,
      dispose: () => {
        canvas.width = canvas.height = 0
      },
    }
  } catch (error) {
    canvas.width = canvas.height = 0
    throw error
  } finally {
    image.onload = image.onerror = null
    image.removeAttribute('src')
    URL.revokeObjectURL(url)
  }
}
