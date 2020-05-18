import React from 'react'

const SizeGuide = ({ product, wide }) => {
  if (!product || !product.sizeGuide) {
    return null
  }

  const data = product.sizeGuide
  const sizeOffset = product.options.indexOf('Size')
  const productSizes = product.variants.map(
    variant => variant.options[sizeOffset]
  )
  const sizes = product.sizeGuide.sizes.filter(
    s => productSizes.indexOf(s.size) >= 0
  )
  // console.log(sizes.length, wide)

  if (!data.measurements.length) {
    return null
  } else if (wide && data.measurements.length <= 4) {
    return null
  } else if (!wide && data.measurements.length > 4) {
    return null
  }

  return (
    <div className="size-guide table-responsive">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Size Guide</th>
            {data.measurements.map((m, idx) => (
              <th key={idx}>{m.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sizes.map(size => (
            <tr key={size.size}>
              <td>{size.size}</td>
              {data.measurements.map((m, idx) => (
                <td key={idx}>{`${size[m.name]}${
                  m.type === 'inches' ? '"' : ''
                }`}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default SizeGuide

require('react-styl')(`
  .size-guide
    margin-top: 1rem
    table
      text-align: center
`)
