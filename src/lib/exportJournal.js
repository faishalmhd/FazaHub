function extensionFor(contentType) {
  const type = contentType.split(';')[0].trim().toLowerCase()
  if (type === 'image/jpeg') return 'jpg'
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  if (type === 'image/avif') return 'avif'
  if (type === 'image/heic') return 'heic'
  throw new Error(`Format foto tidak didukung untuk ekspor: ${type || 'tidak diketahui'}.`)
}

export async function exportJournal(snaps, partnerName, onProgress) {
  if (!snaps.length) throw new Error('Belum ada foto untuk diekspor.')
  const { default: JSZip } = await import('jszip')
  const archive = new JSZip()
  const manifest = []

  for (let index = 0; index < snaps.length; index += 1) {
    const snap = snaps[index]
    const imageUrl = snap.image_url.includes('/upload/')
      ? snap.image_url.replace('/upload/', '/upload/w_1080,f_auto,q_auto/')
      : snap.image_url
    const response = await fetch(imageUrl)
    if (!response.ok) throw new Error(`Foto ${index + 1} gagal diunduh (HTTP ${response.status}).`)
    const blob = await response.blob()
    const extension = extensionFor(response.headers.get('content-type') || blob.type)
    const filename = `${snap.snap_date}/${snap.id}.${extension}`
    archive.file(filename, blob)
    manifest.push({
      file: filename,
      date: snap.snap_date,
      mood: snap.mood,
      note: snap.note,
      author: partnerName(snap.user_id),
      created_at: snap.created_at
    })
    onProgress(index + 1, snaps.length)
  }

  archive.file('metadata.json', JSON.stringify({
    exported_at: new Date().toISOString(),
    photo_count: manifest.length,
    memories: manifest
  }, null, 2))
  const archiveBlob = await archive.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 4 }
  })
  const url = URL.createObjectURL(archiveBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = `fazahub-kenangan-${new Date().toISOString().slice(0, 10)}.zip`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
