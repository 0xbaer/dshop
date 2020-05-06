const omit = require('lodash/omit')
const { Seller, Shop, SellerShop, Network, Sequelize } = require('../models')
const { authSellerAndShop, authRole } = require('./_auth')
const { createSeller } = require('../utils/sellers')
const encConf = require('../utils/encryptedConfig')
const { createShop } = require('../utils/shop')
const setCloudflareRecords = require('../utils/cloudflare')
const get = require('lodash/get')
const set = require('lodash/set')
const fs = require('fs')
const os = require('os')
const configs = require('../scripts/configs')
const deploy = require('ipfs-deploy')
const { exec } = require('child_process')
const prime = require('../utils/primeIpfs')
const ipfsClient = require('ipfs-http-client')

const downloadProductData = require('../scripts/printful/downloadProductData')
const downloadPrintfulMockups = require('../scripts/printful/downloadPrintfulMockups')
const resizePrintfulMockups = require('../scripts/printful/resizePrintfulMockups')
const writeProductData = require('../scripts/printful/writeProductData')

module.exports = function(app) {
  app.get(
    '/shop/users',
    authSellerAndShop,
    authRole('admin'),
    async (req, res) => {
      const users = await Seller.findAll({
        attributes: ['id', 'name', 'email'],
        include: {
          model: Shop,
          attributes: ['id'],
          through: { attributes: ['role'] },
          where: { id: req.shop.id }
        }
      })

      res.json({
        success: true,
        users: users.map(user => {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: get(user, 'Shops[0].SellerShop.role')
          }
        })
      })
    }
  )

  app.get('/shop', async (req, res) => {
    const { sellerId } = req.session

    if (!sellerId) {
      return res.status(400).json({ success: false })
    }

    const rows = await Shop.findAll({ where: { sellerId } })

    const shops = []
    for (const row of rows) {
      const shopData = omit(row.dataValues, ['config', 'sellerId'])
      shopData.dataUrl = await encConf.get(row.id, 'dataUrl')
      shops.push(shopData)
    }

    res.json({ success: true, shops })
  })

  app.post('/shop', async (req, res) => {
    if (!req.session.sellerId) {
      return res.json({ success: false, reason: 'not authed' })
    }

    const existingShop = await Shop.findOne({
      where: {
        [Sequelize.Op.or]: [
          { listingId: req.body.listingId },
          { authToken: req.body.dataDir }
        ]
      }
    })
    if (existingShop) {
      const field =
        existingShop.listingId === req.body.listingId ? 'listingId' : 'dataDir'
      return res.json({
        success: false,
        reason: 'invalid',
        field,
        message: 'Already exists'
      })
    }

    const network = await Network.findOne({ where: { active: true } })
    const networkConfig = encConf.getConfig(network.config)
    const netAndVersion = `${network.networkId}-${network.marketplaceVersion}`
    if (req.body.listingId.indexOf(netAndVersion) !== 0) {
      return res.json({
        success: false,
        reason: 'invalid',
        field: 'listingId',
        message: `Must start with ${netAndVersion}`
      })
    }

    const shopResponse = await createShop({
      listingId: req.body.listingId,
      name: req.body.name,
      authToken: req.body.dataDir,
      sellerId: req.session.sellerId
    })

    if (!shopResponse.shop) {
      console.log(`Error creating shop: ${shopResponse.error}`)
      return res
        .status(400)
        .json({ success: false, message: 'Invalid shop data' })
    }

    const shopId = shopResponse.shop.id

    const config = {
      dataUrl: `https://${req.body.hostname}/${req.body.dataDir}/`,
      publicUrl: '',
      printful: req.body.printfulApi,
      stripeBackend: '',
      stripeWebhookSecret: '',
      pgpPublicKey: req.body.pgpPublicKey,
      pgpPrivateKey: req.body.pgpPrivateKey,
      pgpPrivateKeyPass: req.body.pgpPrivateKeyPass
    }

    console.log(`Created shop ${shopId}`)
    await encConf.assign(shopId, config)
    console.log(`Assigned config OK`)

    const role = 'admin'
    await SellerShop.create({ sellerId: req.session.sellerId, shopId, role })
    console.log(`Added role OK`)

    const { dataDir, name, pgpPublicKey, printfulApi, shopType } = req.body

    if (shopType === 'blank') {
      return res.json({ success: true })
    }

    const OutputDir = `${os.tmpdir()}/dshop`
    await new Promise(resolve => exec(`rm -rf ${OutputDir}`, resolve))
    fs.mkdirSync(OutputDir, { recursive: true })
    console.log(`Outputting to ${OutputDir}`)

    await new Promise((resolve, reject) => {
      exec(
        `cp -r ${__dirname}/../dist ${OutputDir}/public`,
        (error, stdout) => {
          if (error) reject(error)
          else resolve(stdout)
        }
      )
    })

    const networkName =
      network.networkId === 1
        ? 'mainnet'
        : network.networkId === 4
        ? 'rinkeby'
        : 'localhost'
    const html = fs.readFileSync(`${OutputDir}/public/index.html`).toString()
    fs.writeFileSync(
      `${OutputDir}/public/index.html`,
      html
        .replace('TITLE', name)
        .replace('DATA_DIR', dataDir)
        .replace('PROVIDER', network.provider)
        .replace('NETWORK', networkName)
    )

    let shopConfig = {
      ...configs.shopConfig,
      title: name,
      fullTitle: name,
      backendAuthToken: dataDir,
      supportEmail: `${name} Store <${dataDir}@ogn.app>`,
      emailSubject: `Your ${name} Order`,
      pgpPublicKey: pgpPublicKey.replace(/\\r/g, '')
    }
    shopConfig = set(
      shopConfig,
      `networks[${network.networkId}].backend`,
      req.body.backend
    )
    shopConfig = set(
      shopConfig,
      `networks[${network.networkId}].listingId`,
      req.body.listingId
    )

    console.log(`Shop type: ${shopType}`)

    if (shopType === 'printful' && printfulApi) {
      const apiAuth = Buffer.from(printfulApi).toString('base64')
      const PrintfulURL = 'https://api.printful.com'

      await downloadProductData({ OutputDir, PrintfulURL, apiAuth })
      await writeProductData({ OutputDir })
      await downloadPrintfulMockups({ OutputDir })
      await resizePrintfulMockups({ OutputDir })
    } else if (shopType === 'single-product' || shopType === 'multi-product') {
      await new Promise((resolve, reject) => {
        exec(
          `cp -r ${__dirname}/../data/shop-templates/${shopType} ${OutputDir}/data`,
          (error, stdout) => {
            if (error) reject(error)
            else resolve(stdout)
          }
        )
      })
    }

    const shopConfigPath = `${OutputDir}/data/config.json`
    fs.writeFileSync(shopConfigPath, JSON.stringify(shopConfig, null, 2))

    const shippingContent = JSON.stringify(configs.shipping, null, 2)
    fs.writeFileSync(`${OutputDir}/data/shipping.json`, shippingContent)

    await new Promise((resolve, reject) => {
      exec(
        `mv ${OutputDir}/data ${OutputDir}/public/${dataDir}`,
        (error, stdout) => {
          if (error) reject(error)
          else resolve(stdout)
        }
      )
    })

    let hash
    const publicDirPath = `${OutputDir}/public`
    if (networkConfig.pinataKey) {
      hash = await deploy({
        publicDirPath,
        remotePinners: ['pinata'],
        siteDomain: dataDir,
        credentials: {
          pinata: {
            apiKey: networkConfig.pinataKey,
            secretApiKey: networkConfig.pinataSecret
          }
        }
      })

      await prime(`https://gateway.pinata.cloud/ipfs/${hash}`, publicDirPath)
      await prime(`https://gateway.ipfs.io/ipfs/${hash}`, publicDirPath)
      await prime(`https://ipfs-prod.ogn.app/ipfs/${hash}`, publicDirPath)
    } else if (network.ipfsApi.indexOf('localhost') > 0) {
      const ipfs = ipfsClient(network.ipfsApi)
      const allFiles = []
      const glob = ipfsClient.globSource(publicDirPath, { recursive: true })
      for await (const file of ipfs.add(glob)) {
        allFiles.push(file)
      }
      hash = String(allFiles[allFiles.length - 1].cid)
    }

    let domain
    if (networkConfig.cloudflareApiKey) {
      const subdomain = req.body.hostname
      const zone = networkConfig.domain
      domain = `https://${subdomain}.${zone}`

      await setCloudflareRecords({
        email: networkConfig.cloudflareEmail,
        key: networkConfig.cloudflareApiKey,
        ipfsGateway: 'ipfs-prod.ogn.app',
        zone,
        subdomain,
        hash
      })
    }

    res.json({ success: true, hash, domain, gateway: network.ipfs })
  })

  app.post(
    '/shop/add-user',
    authSellerAndShop,
    authRole('admin'),
    async (req, res, next) => {
      const { seller, status, error } = await createSeller(req.body)

      if (error) {
        return res.status(status).json({ success: false, message: error })
      }

      if (!seller) {
        return res.json({ success: false })
      }

      SellerShop.create({
        sellerId: seller.id,
        shopId: req.shop.id,
        role: req.body.role
      })
        .then(() => {
          res.json({ success: true })
        })
        .catch(err => {
          console.error(err)
          next(err)
        })
    }
  )

  app.delete(
    '/shop',
    authSellerAndShop,
    authRole('admin'),
    async (req, res) => {
      await Shop.destroy({
        where: {
          id: req.body.id,
          sellerId: req.session.sellerId
        }
      })
      res.json({ success: true })
    }
  )
}
