const ACCEPTED_PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_SOURCE_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_PROFILE_IMAGE_DATA_URL_LENGTH = 48_000
const PROFILE_IMAGE_SIZE = 192

export const PROFILE_IMAGE_HELP = 'Upload a JPG, PNG, or WebP. DebateHelp compresses it before saving.'

export async function prepareProfileImage(file) {
  if (!file) {
    return ''
  }

  if (!ACCEPTED_PROFILE_IMAGE_TYPES.has(file.type)) {
    throw new Error('Use a JPG, PNG, or WebP image.')
  }

  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error('Choose an image under 5 MB.')
  }

  const image = await loadImage(file)
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error('Unable to read that image. Try another file.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = PROFILE_IMAGE_SIZE
  canvas.height = PROFILE_IMAGE_SIZE

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Your browser could not prepare this image.')
  }

  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight)
  const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2)
  const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2)

  context.clearRect(0, 0, PROFILE_IMAGE_SIZE, PROFILE_IMAGE_SIZE)
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    PROFILE_IMAGE_SIZE,
    PROFILE_IMAGE_SIZE,
  )

  for (const quality of [0.82, 0.72, 0.62, 0.52]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    if (dataUrl.length <= MAX_PROFILE_IMAGE_DATA_URL_LENGTH) {
      return dataUrl
    }
  }

  throw new Error('This image is still too complex after compression. Try a simpler or smaller image.')
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Unable to read that image. Try another file.'))
    }

    image.src = objectUrl
  })
}
