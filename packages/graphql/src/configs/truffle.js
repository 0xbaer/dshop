const HOST = process.env.HOST || 'localhost'

let addresses = {}
try {
  addresses = require('@origin/contracts/build/contracts.json')
} catch (e) {
  /* No local contracts */
}

const config = {
  networkId: 999,
  provider: `http://${HOST}:8545`,
  providerWS: `ws://${HOST}:8545`,
  ipfsGateway: `http://${HOST}:8080`,
  ipfsRPC: `http://${HOST}:5002`,
  growth: `http://${HOST}:4008`,
  bridge: `http://${HOST}:5000`,
  performanceMode: false,
  graphql: `http://${HOST}:4002`,
  automine: 2000,
  attestationIssuer: '0x99C03fBb0C995ff1160133A8bd210D0E77bCD101',
  messaging: {
    globalKeyServer: `http://${HOST}:6647`
  },
  authServer: `http://${HOST}:5200`,
  affiliate: addresses.Affiliate,
  arbitrator: addresses.Arbitrator,
  OriginToken: addresses.OGN,
  V00_Marketplace: addresses.Marketplace,
  IdentityEvents: addresses.IdentityEvents,
  DaiExchange: addresses.UniswapDaiExchange,
  tokens: []
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
