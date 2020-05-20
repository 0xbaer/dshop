const queues = require('./queues')

const Web3 = require('web3')

const { ListingID } = require('../utils/id')
const { Shop, Network } = require('../models')
const { post, getBytes32FromIpfsHash } = require('../utils/_ipfs')
const encConf = require('../utils/encryptedConfig')
const abi = require('../utils/_abi')

const ZeroAddress = '0x0000000000000000000000000000000000000000'

function attachToQueue() {
  const queue = queues['makeOfferQueue']
  queue.process(processor)
  queue.resume() // Start if paused
}

/**
 * Processes a credit card transaction and submit it to the blockchain.
 *
 * job.data should have {shopId, amount, encryptedData}
 * @param {*} job
 */
async function processor(job) {
  const log = (progress, str) => {
    job.log(str)
    job.progress(progress)
  }

  const { shopId, amount, encryptedData } = job.data
  const shop = await getShop(shopId)
  log(5, 'Load encrypted shop config')
  const shopConfig = getShopConfig(shop)
  const network = await getNetwork(shop.networkId)

  log(10, 'Creating offer')
  const lid = ListingID.fromFQLID(shop.listingId)
  const offer = createOfferJson(lid, amount, encryptedData)
  const ires = await postOfferIPFS(network, offer)

  log(20, 'Submitting Offer')
  const web3 = new Web3(network.provider)
  const account = web3.eth.accounts.wallet.add(shopConfig.web3Pk)
  const walletAddress = account.address
  log(22, `using walletAddress ${walletAddress}`)
  log(25, 'Sending to marketplace')
  const tx = await offerToMarketplace(
    web3,
    lid,
    network,
    walletAddress,
    offer,
    ires
  )
  log(50, JSON.stringify(tx))

  // TODO: Code to prevent duplicate txs
  // TODO Record tx and wait for TX to go through the blockchain

  log(100, 'Finished')
}

async function getShop(id) {
  try {
    return await Shop.findOne({ where: { id } })
  } catch (err) {
    err.message = `Could not load shop from ID '${id}'. ${err.message}`
    throw err
  }
}

async function getNetwork(networkId) {
  const network = await Network.findOne({
    where: { networkId: networkId, active: true }
  })
  if (!network) {
    throw new Error(`Could not find network ${networkId}`)
  }
  if (!network.marketplaceContract) {
    throw new Error(
      'Missing marketplaceContract address for network. Unable to send transaction.'
    )
  }
  return network
}

function getShopConfig(shop) {
  const shopConfig = encConf.getConfig(shop.config)
  if (!shopConfig.web3Pk) {
    throw new Error('No PK configured for shop')
  }
  return shopConfig
}

function createOfferJson(lid, amount, encryptedData) {
  return {
    schemaId: 'https://schema.originprotocol.com/offer_2.0.0.json',
    listingId: lid.toString(),
    listingType: 'unit',
    unitsPurchased: 1,
    totalPrice: {
      amount: 0,
      currency: 'encrypted'
    },
    commission: { currency: 'OGN', amount: '0' },
    finalizes: 60 * 60 * 24 * 14, // 2 weeks after offer accepted
    encryptedData: encryptedData
  }
}

async function postOfferIPFS(network, offer) {
  try {
    return await post(network.ipfsApi, offer, true)
  } catch (err) {
    err.message = `Error adding offer to ${network.ipfsApi}! ${err.message}`
    throw err
  }
}

async function offerToMarketplace(
  web3,
  lid,
  network,
  walletAddress,
  offer,
  ires
) {
  const Marketplace = new web3.eth.Contract(abi, network.marketplaceContract)
  const offerTx = Marketplace.methods.makeOffer(
    lid.listingId,
    getBytes32FromIpfsHash(ires),
    offer.finalizes,
    ZeroAddress, // Affiliate
    '0',
    '0',
    ZeroAddress,
    walletAddress // Arbitrator
  )
  const tx = await offerTx.send({ from: walletAddress, gas: 350000 })
  return tx
}

module.exports = { processor, attachToQueue }
