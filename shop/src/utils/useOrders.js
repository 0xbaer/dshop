import { useEffect, useState } from 'react'
import { useStateValue } from 'data/state'
import useConfig from 'utils/useConfig'
import sortBy from 'lodash/sortBy'

function useOrders() {
  const { config } = useConfig()
  const [loading, setLoading] = useState(false)
  const [shouldReload, setReload] = useState(1)
  const [{ orders }, dispatch] = useStateValue()

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true)
      const raw = await fetch(`${config.backend}/orders`, {
        credentials: 'include',
        headers: {
          authorization: `bearer ${config.backendAuthToken}`
        }
      })
      const ordersRaw = await raw.json()
      const orders = ordersRaw.map(order => {
        return {
          ...order,
          data: JSON.parse(order.data)
        }
      })
      const sortedOrders = sortBy(orders, order => {
        return -Number(order.orderId.split('-')[3])
      })

      setLoading(false)

      dispatch({ type: 'setOrders', orders: sortedOrders })
    }

    fetchOrders()
  }, [shouldReload])

  return { orders, loading, reload: () => setReload(shouldReload + 1) }
}

export default useOrders
