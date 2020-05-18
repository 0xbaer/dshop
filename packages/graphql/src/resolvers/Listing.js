import contracts from '../contracts'
import parseId from '../utils/parseId'
import currencies from '../utils/currencies'
import get from 'lodash/get'

export default {
  __resolveType() {
    return 'UnitListing'
  },
  events: async listing => {
    const { listingId } = parseId(listing.id)
    return await listing.contract.eventCache.getEvents({
      listingID: String(listingId)
    })
  },
  totalEvents: async listing => {
    const { listingId } = parseId(listing.id)
    return (
      await listing.contract.eventCache.getEvents({
        listingID: String(listingId)
      })
    ).length
  },
  totalOffers: listing => {
    const { listingId } = parseId(listing.id)
    return listing.contract.methods.totalOffers(listingId).call()
  },
  offer: async (listing, args) => {
    const { listingId, offerId, marketplace } = parseId(args.id)
    if (!marketplace) {
      return null
    }
    return marketplace.eventSource.getOffer(listingId, offerId)
  },
  offers: async listing => listing.allOffers.filter(o => o.valid),
  createdEvent: async listing => {
    const { listingId } = parseId(listing.id)
    const events = await listing.contract.eventCache.getEvents({
      listingID: String(listingId),
      event: 'ListingCreated'
    })
    return events[0]
  },
  price: async listing => {
    return {
      amount: get(listing, 'price.amount'),
      currency: await currencies.get(
        get(listing, 'price.currency.id', 'token-ETH')
      )
    }
  },
  contractAddr: listing => {
    const { contractId } = parseId(listing.id)
    return get(
      contracts,
      `marketplaces['${contractId}'].contract.options.address`
    )
  }
}
