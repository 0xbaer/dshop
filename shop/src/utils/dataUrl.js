const CONTENT_CDN = process.env.CONTENT_CDN || ''
const CONTENT_HASH = process.env.CONTENT_HASH || ''

let DATA_DIR
try {
  DATA_DIR =
    document.querySelector('link[rel="data-dir"]').getAttribute('href') ||
    sessionStorage.dataDir
} catch (e) {
  /* Ignore */
}

const CDN = CONTENT_CDN.split(',').reduce((m, o) => {
  const [from, to] = o.split('#')
  m[from] = to || from
  return m
}, {})

export default function dataUrl() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  let dir
  if (pathname.indexOf('/ipfs/') === 0 && CONTENT_HASH) {
    dir = `/ipfs/${CONTENT_HASH}/`
  } else if (CDN[origin]) {
    dir = `${CDN[origin] || ''}${DATA_DIR || ''}/`
  } else if (CONTENT_CDN) {
    dir = `${CONTENT_CDN}${DATA_DIR || ''}/`
  } else {
    dir = `${DATA_DIR || ''}`
    if (!dir.endsWith('/')) {
      dir += '/'
    }
  }
  return dir
}
