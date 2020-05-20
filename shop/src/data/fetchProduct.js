import memoize from 'lodash/memoize'
import dataUrl from 'utils/dataUrl'

async function fetchProduct(id) {
  const raw = await fetch(`${dataUrl()}${id}/data.json`)
  if (raw.ok) {
    return await raw.json()
  } else {
    return null
  }
}

export default memoize(fetchProduct)
