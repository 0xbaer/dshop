import fetch from 'node-fetch'

import contracts from '../contracts'

const API_TIMEOUT_MS = 5000 // 5sec
const EXCHANGE_RATES_POLL_INTERVAL = 10 * 60 * 1000 // 10 min.

let fetching = false
const requestQueue = []
const isDone = () => new Promise(resolve => requestQueue.push(resolve))

let OGN_PER_USD = 1 / 0.15 // 1 OGN = 0.15 USD

if (process.env.NODE_ENV === 'test') {
  OGN_PER_USD = 1 // Keeping it simple for tests
}

class Currencies {
  constructor() {
    // Note:
    // 1. We set default values for the priceInUSD field in case the
    // centralized server we query to dynamically fetch exchange rates is down.
    // We have an open issue https://github.com/OriginProtocol/origin/issues/1860
    // to show a warning banner to the user in case rates are stale.
    // 2. When updating this list, make sure to also update it in other
    // places. See https://github.com/OriginProtocol/origin/issues/2990
    this.data = {
      'fiat-USD': {
        id: 'fiat-USD',
        name: 'US Dollar',
        code: 'USD',
        priceInUSD: 1,
        countryCodes: ['US']
      },
      'fiat-GBP': {
        id: 'fiat-GBP',
        name: 'British Pound',
        code: 'GBP',
        priceInUSD: 1.31,
        countryCodes: ['GB']
      },
      'fiat-EUR': {
        id: 'fiat-EUR',
        name: 'Euro',
        code: 'EUR',
        priceInUSD: 1.12,
        countryCodes: ['FR']
      },
      'fiat-KRW': {
        id: 'fiat-KRW',
        name: 'South Korean Won',
        code: 'KRW',
        priceInUSD: 0.0009,
        countryCodes: ['KR']
      },
      'fiat-JPY': {
        id: 'fiat-JPY',
        name: 'Japanese Yen',
        code: 'JPY',
        priceInUSD: 0.1441,
        countryCodes: ['JP']
      },
      'fiat-CNY': {
        id: 'fiat-CNY',
        name: 'Chinese Yuan',
        code: 'CNY',
        priceInUSD: 0.15,
        countryCodes: ['CN']
      },
      'fiat-SGD': {
        id: 'fiat-SGD',
        name: 'Singapore Dollar',
        code: 'SGD',
        priceInUSD: 0.74,
        countryCodes: ['SG']
      },
      'token-ETH': {
        id: 'token-ETH',
        address: '0x0000000000000000000000000000000000000000',
        code: 'ETH',
        name: 'Ethereum',
        priceInUSD: 158.16,
        decimals: 18
      },
      'token-DAI': {
        id: 'token-DAI',
        // address: '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359',
        name: 'Maker Dai',
        code: 'DAI',
        priceInUSD: 1,
        decimals: 18
      },
      'token-OGN': {
        id: 'token-OGN',
        name: 'Origin Token',
        code: 'OGN',
        priceInUSD: OGN_PER_USD,
        decimals: 18
      },
      'token-USDC': {
        id: 'token-USDC',
        // address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        name: 'USDC Stablecoin',
        code: 'USDC',
        priceInUSD: 1,
        decimals: 6
      },
      'token-GUSD': {
        id: 'token-GUSD',
        // address: '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
        name: 'Gemini Dollar',
        code: 'GUSD',
        priceInUSD: 1,
        decimals: 2
      },
      'token-OKB': {
        id: 'token-OKB',
        name: 'OKB Token',
        code: 'OKB',
        priceInUSD: 3,
        decimals: 18
      },
      'token-USDT': {
        id: 'token-USDT',
        name: 'Tether',
        code: 'USDT',
        priceInUSD: 1,
        decimals: 6
      }
    }

    // Start the background polling of exchange rates.
    this.polled = false
    if (process.env.NODE_ENV !== 'test') {
      this.interval = setInterval(async () => {
        this._poll()
      }, EXCHANGE_RATES_POLL_INTERVAL)
    }
  }

  /**
   * Fetches and updates exchange rates.
   * @returns {Promise<boolean>} Returns true if rates updated successfully. False otherwise.
   */
  async _poll() {
    // Fetch rates from @origin/bridge.
    const url = `${contracts.config.bridge}/utils/exchange-rates`

    let rates
    try {
      const response = await fetch(url, { timeout: API_TIMEOUT_MS })
      rates = await response.json()
    } catch (e) {
      console.error('API call to fetch xrates from @origin/bridge failed.')
      return false
    }

    // Update rates in our data structure.
    for (const key of Object.keys(this.data)) {
      const currencyCode = this.data[key].code
      if (!rates[currencyCode]) {
        console.error(
          `@origin/bridge did not return xrate for ${currencyCode}.`
        )
        continue
      }
      // Note: We inverse the rate since we query CryptoCompare for rates
      // from USD to other currencies, but we store price of a given currency in USD.
      // CryptoCompare has another api (called pricemulti) that we could use so that
      // we don't have to reverse but it does not work for all currencies (ex. KRW).
      this.data[key].priceInUSD = 1.0 / rates[currencyCode]
    }
    this.polled = true
    return true
  }

  /**
   * Returns data about a currency based on its id.
   * @param currencyId
   * @returns {{name:string, code:string, priceInUSD:string, countryCode:string}}
   */
  async get(currencyId) {
    if (!this.data[currencyId]) {
      throw new Error('Unsupported currency id', currencyId)
    }
    if (process.env.NODE_ENV === 'test') {
      return this.data[currencyId]
    }

    // Wait until any existing fetching is completed before continuing
    // execution. This prevents multiple requests being fired at the same time
    // on initial page load.
    if (fetching) await isDone()
    fetching = true

    // Poll exchange rates if they haven't been populated yet.
    if (!this.polled) {
      if ((await this._poll()) !== true) {
        console.error(
          'Failed fetching currency exchange rates. Falling back to stale rates.'
        )
      }
    }

    // Let any queued requests continue their execution
    fetching = false
    while (requestQueue.length) {
      requestQueue.pop()()
    }

    return this.data[currencyId]
  }

  ids() {
    return Object.keys(this.data)
  }
}

// Create a singleton currency object.
const currencies = new Currencies()

export default currencies
