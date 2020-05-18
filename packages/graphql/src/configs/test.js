const HOST = process.env.HOST || 'localhost'
const localStorageHas = require('./_localStorageHas')

let addresses = {}
try {
  addresses = require('@origin/contracts/build/tests.json')
} catch (e) {
  /* No local contracts */
}

const config = {
  networkId: 999,
  provider: `http://${HOST}:8545`,
  providerWS: `ws://${HOST}:8545`,
  ipfsGateway: `http://${HOST}:8080`,
  ipfsRPC: `http://${HOST}:5002`,
  bridge: 'https://bridge.dev.originprotocol.com',
  identityServer: `http://${HOST}:5000`,
  graphql: `http://${HOST}:4007`,
  relayer: `http://${HOST}:5100`,
  authServer: `http://${HOST}:5200`,
  automine: 500,
  attestationIssuer: '0x5be37555816d258f5e316e0f84D59335DB2400B2',

  affiliate: addresses.Affiliate,
  arbitrator: addresses.Arbitrator,
  OriginToken: addresses.OGN,
  V00_Marketplace: addresses.Marketplace,
  V00_Marketplace_Epoch: addresses.MarketplaceEpoch,
  V01_Marketplace: addresses.Marketplace_V01,
  V01_Marketplace_Epoch: addresses.MarketplaceEpoch_V01,
  marketplaceVersion: '000,001',
  IdentityEvents: addresses.IdentityEvents,
  DaiExchange: addresses.UniswapDaiExchange,
  ProxyFactory: addresses.ProxyFactory,
  IdentityProxyImplementation: addresses.IdentityProxyImplementation,

  tokens: [],

  // Wire-on/off configs.
  centralizedIdentityEnabled: localStorageHas(
    'centralizedIdentityEnabled',
    'true'
  ),
  performanceMode: localStorageHas('performanceMode', 'true'),
  proxyAccountsEnabled: localStorageHas('proxyAccountsEnabled', 'true'),
  relayerEnabled: localStorageHas('relayerEnabled', 'true')
}

if (addresses.DAI) {
  config.tokens.push({
    id: addresses.DAI,
    type: 'Standard',
    name: 'DAI Stablecoin',
    symbol: 'DAI',
    decimals: '18'
  })
}

if (addresses.OKB) {
  config.tokens.push({
    id: addresses.OKB,
    type: 'Standard',
    name: 'OKB Token',
    symbol: 'OKB',
    decimals: '18'
  })
}

if (addresses.USDT) {
  config.tokens.push({
    id: addresses.USDT,
    type: 'Standard',
    name: 'Tether',
    symbol: 'USDT',
    decimals: '18'
  })
}

export default config
