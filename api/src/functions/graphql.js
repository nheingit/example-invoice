import { graphQLServerlessFunction } from '@hammerframework/hammer-api'
import { AuthenticationError } from 'apollo-server-lambda'

import { getAccessToken } from 'src/lib/auth0'
import Photon from '../../generated/photon'

export const userFindOrCreate = async ({ sub }) => {
  const photon = new Photon()

  const { id, user } = await photon().accessTokens.upsert({
    where: { sub },
    update: { sub },
    create: { sub },
    select: {
      id: true,
      sub: true,
      user: true,
    },
  })

  if (user) {
    return user
  }

  // If the user is null then we have to create one.
  // Ordinarily we would fetch a normalized standard identifier
  // like the email address, but for now we'll just stick to
  // one account per identity service.
  // https://auth0.com/docs/users/normalized/auth0/identify-users
  const newUser = await photon().users.create({
    data: {
      accessTokens: {
        connect: { id: id },
      },
    },
  })
  return newUser
}

const server = graphQLServerlessFunction({
  context: async ({ event }) => {
    const photon = new Photon()

    return {
      photon,
      currentUser: async () => {
        try {
          const accessToken = await getAccessToken(event.headers)
          return userFindOrCreate(accessToken)
        } catch (e) {
          throw new AuthenticationError('You are not authenticated')
        }
      },
    }
  },
})

export const handler = server.createHandler()
