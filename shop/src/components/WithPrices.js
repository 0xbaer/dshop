import withCurrencyBalances from 'hoc/withCurrencyBalances'
import get from 'lodash/get'
import floor from 'lodash/floor'

// web3.utils.toWei only accepts up to 18 decimal places
function removeExtraDecimals(numStr) {
  return numStr.replace(/^([0-9]+\.[0-9]{18}).*/, '$1')
}

/**
 * Given a list of tokens and a price, returns an object with information on
 * whether the current account has enough balance and allowance to pay.
 *
 * If a `listing` is passed in as a prop, will pass down a `suggestedToken` prop
 * set to the token the user has enough balance to pay for, avoiding token swaps
 * if possible. Eg if the listing is set to accept Eth and Dai, and the user has
 * enough Eth, it will suggest to pay in Eth to avoid a swap.
 *
 * Example usage:
 *
 * <WithPrices
 *   listing={listing} // If listing is provided, suggestedToken will be populated
 *   price={{ currency: 'fiat-USD', amount: '100' }}
 *   targets={['token-ETH', 'token-DAI']}
 * >
 *   {{ tokenStatus, suggestedToken } => {
 *      // tokenStatus: {
 *      //   'token-ETH': { hasBalance: false, hasAllowance: true, needsAllowance: '0', needsBalance: '1000000000' },
 *      //   'token-DAI': { hasBalance: true, hasAllowance: false, needsAllowance: '1000000000', needsBalance: '0' }
 *      // },
 *      // suggestedToken: 'token-DAI'
 *   }}
 * </WithPrices>
 */
const WithPrices = ({
  targets = [], // List of currencies to return the status of
  price = {}, // Price to base status of
  listing, // Optional listing.
  currencies, // Passed in from withCurrencyBalances hoc
  proxyCurrencies, // Passed in from withCurrencyBalances hoc
  children,
  refetchBalances,
  ...props
}) => {
  const { currency, amount } = price
  proxyCurrencies = proxyCurrencies.length ? proxyCurrencies : currencies

  const isLoadingData = Object.keys(props).some(
    key => key.endsWith('Loading') && props[key]
  )

  // loading: true if wallet or anything else is loading
  if (isLoadingData) {
    return children({ prices: {}, tokenStatus: { loading: true } })
  }
  // If there is no wallet after it has loaded, return loading: false
  if (!props.wallet) {
    return children({ prices: {}, tokenStatus: { loading: false } })
  }

  if (!currency) {
    return children({ prices: {}, tokenStatus: { loading: true } })
  }
  const foundCurrency = currencies.find(c => c.id === currency.id)
  if (!foundCurrency || !targets) {
    return children({ prices: {}, tokenStatus: { loading: true } })
  }

  const wallet = targets.reduce((memo, target) => {
    const targetCurrency = currencies.find(c => c.id === target)
    if (!targetCurrency) return memo

    const amountUSD = amount * foundCurrency.priceInUSD
    const targetAmount = floor(amountUSD / targetCurrency.priceInUSD, 16)

    memo[target] = { amount: String(targetAmount), currency: targetCurrency }
    return memo
  }, {})

  const proxy = targets.reduce((memo, target) => {
    const targetCurrency = proxyCurrencies.find(c => c.id === target)
    if (!targetCurrency) return memo

    const amountUSD = amount * foundCurrency.priceInUSD
    const targetAmount = floor(amountUSD / targetCurrency.priceInUSD, 16)

    memo[target] = { amount: String(targetAmount), currency: targetCurrency }
    return memo
  }, {})

  const tokenStatus = targets.reduce((memo, target) => {
    memo[target] = tokenStatusFor(target, wallet, proxy)
    return memo
  }, {})

  let suggestedToken
  if (listing) {
    const acceptsEth = listing.acceptedTokens.find(t => t.id === 'token-ETH')
    const acceptsDai = listing.acceptedTokens.find(t => t.id === 'token-DAI')

    if (acceptsEth && get(tokenStatus, 'token-ETH.hasBalance')) {
      suggestedToken = 'token-ETH'
    } else if (acceptsDai) {
      suggestedToken = 'token-DAI'
    } else {
      suggestedToken = 'token-ETH'
    }
  }

  return children({
    prices: wallet,
    tokenStatus,
    suggestedToken,
    refetchBalances
  })
}

function tokenStatusFor(target, wallet, proxy) {
  const targetWei = removeExtraDecimals(get(wallet, `${target}.amount`) || '0')
  const targetValue = web3.utils.toBN(web3.utils.toWei(targetWei, 'ether'))

  const walletBalance = get(wallet, `${target}.currency.balance`) || '0'
  const availableBalance = web3.utils.toBN(walletBalance)
  const proxyAllowance = get(proxy, `${target}.currency.allowance`) || '0'
  const availableAllowance = web3.utils.toBN(proxyAllowance)

  const hasBalance = availableBalance.gte(targetValue)
  const neededBalance = targetValue.sub(availableBalance).toString()

  const neededAllowance = targetValue.sub(availableAllowance).toString()

  let hasAllowance = availableAllowance.gte(targetValue)
  if (target === 'token-ETH') {
    hasAllowance = true
  }

  return {
    hasBalance,
    hasAllowance,
    needsAllowance: hasAllowance ? 0 : neededAllowance,
    needsBalance: hasBalance ? 0 : neededBalance,
    value: targetWei
  }
}

export default withCurrencyBalances(WithPrices)
