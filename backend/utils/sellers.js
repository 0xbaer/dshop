const { Seller } = require('../models')
const { createSalt, hashPassword, checkPassword } = require('../routes/_auth')

async function createSeller({ name, email, password }, opts) {
  if (!name || !email || !password) {
    return { status: 400, error: 'Invalid registration' }
  }
  const { superuser } = opts || {} // Superuser creation must be done explicitly

  const sellerCheck = await Seller.findOne({
    where: { email: email.toLowerCase() }
  })

  if (sellerCheck) {
    return { status: 409, error: 'Registration exists' }
  }

  const salt = await createSalt()
  const passwordHash = await hashPassword(salt, password)

  const seller = await Seller.create({
    name,
    email,
    password: passwordHash,
    superuser: superuser
  })

  return { seller }
}

async function numSellers() {
  return await Seller.count()
}

async function findSeller(email) {
  const seller = await Seller.findOne({ where: { email } })
  return seller
}

async function authSeller(email, password) {
  const seller = await Seller.findOne({ where: { email } })
  return await checkPassword(password, seller.password)
}

module.exports = { findSeller, createSeller, authSeller, numSellers }
