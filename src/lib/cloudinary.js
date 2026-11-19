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

export async function uploadAudioToCloudinary(audioBlob) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary belum dikonfigurasi untuk mengirim pesan suara.')
  }
  if (!(audioBlob instanceof Blob) || audioBlob.size === 0) {
    throw new Error('Rekaman suara kosong atau tidak valid.')
  }

  const body = new FormData()
  const extension = audioBlob.type.includes('mp4') ? 'm4a' : 'webm'
  body.append('file', audioBlob, `voice-note.${extension}`)
  body.append('upload_preset', uploadPreset)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/auto/upload`, {
    method: 'POST',
    body
  })

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error('Respons Cloudinary untuk pesan suara tidak dapat dibaca.')
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || 'Pesan suara gagal diunggah ke Cloudinary.')
  }
  if (!payload.secure_url) {
    throw new Error('Cloudinary tidak mengembalikan alamat audio yang aman.')
  }
  return payload.secure_url
}

export function optimizedImage(url, thumbnail = false) {
  if (!url?.includes('/upload/')) return url
  return url.replace('/upload/', thumbnail
    ? '/upload/w_300,c_fill,f_auto,q_auto/'
    : '/upload/w_1080,f_auto,q_auto/')
}
