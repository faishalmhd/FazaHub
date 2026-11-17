export function uploadImage(file, cloudName, uploadPreset, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    const body = new FormData()
    body.append('file', file)
    body.append('upload_preset', uploadPreset)

    request.open('POST', `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`)
    request.upload.addEventListener('progress', event => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    })
    request.addEventListener('error', () => reject(new Error('Koneksi terputus saat mengunggah foto. Periksa internet lalu coba lagi.')))
    request.addEventListener('abort', () => reject(new Error('Unggahan foto dibatalkan.')))
    request.addEventListener('load', () => {
      let payload
      try {
        payload = JSON.parse(request.responseText)
      } catch {
        reject(new Error('Respons Cloudinary tidak dapat dibaca.'))
        return
      }

      if (request.status < 200 || request.status >= 300) {
        reject(new Error(payload.error?.message || 'Foto gagal diunggah ke Cloudinary.'))
        return
      }
      if (!payload.secure_url) {
        reject(new Error('Cloudinary tidak mengembalikan alamat foto yang aman.'))
        return
      }
      resolve(payload.secure_url)
    })
    request.send(body)
  })
}

export function optimizedImage(url, thumbnail = false) {
  if (!url?.includes('/upload/')) return url
  return url.replace('/upload/', thumbnail
    ? '/upload/w_300,c_fill,f_auto,q_auto/'
    : '/upload/w_1080,f_auto,q_auto/')
}
