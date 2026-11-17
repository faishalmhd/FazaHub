const MAX_DIMENSION = 1600

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Browser gagal memproses foto. Pilih JPG atau PNG lalu coba lagi.'))
    }, 'image/jpeg', quality)
  })
}

export async function compressImage(file) {
  let bitmap
  let imageUrl
  let source

  try {
    if ('createImageBitmap' in window) {
      try {
        bitmap = await createImageBitmap(file, {
          imageOrientation: 'from-image',
          resizeWidth: MAX_DIMENSION,
          resizeQuality: 'high'
        })
        source = bitmap
      } catch {
        // Some mobile browsers cannot decode HEIC with createImageBitmap; try their native image decoder.
        source = null
      }
    }
    if (!source) {
      imageUrl = URL.createObjectURL(file)
      const image = new Image()
      image.src = imageUrl
      await image.decode()
      source = image
    }

    const scale = Math.min(1, MAX_DIMENSION / Math.max(source.width, source.height))
    const width = Math.max(1, Math.round(source.width * scale))
    const height = Math.max(1, Math.round(source.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Browser ini tidak mendukung pemrosesan foto.')
    context.drawImage(source, 0, 0, width, height)
    const blob = await canvasToJpeg(canvas, 0.85)
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'fazahub'}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now()
    })
  } catch (error) {
    if (error instanceof Error && /decode|unsupported|image format|bitmap/i.test(error.message)) {
      throw new Error('Format foto ini belum bisa dibaca browser untuk kompresi. Coba pilih JPG atau PNG dari galeri.')
    }
    throw error
  } finally {
    bitmap?.close()
    if (imageUrl) URL.revokeObjectURL(imageUrl)
  }
}
