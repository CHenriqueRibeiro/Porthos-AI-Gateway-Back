const prisma = require("../db/prisma")

async function createUser({ email, name }) {
  return prisma.user.create({
    data: {
      email,
      name
    }
  })
}

module.exports = {
  createUser
}