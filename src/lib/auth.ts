import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import dbConnect from '@/lib/db'
import { UserModel } from '@/models/User'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Restrict to a specific Workspace domain when set (e.g. "yourcompany.com")
      // Leave unset to allow any Google account
      authorization: {
        params: {
          prompt: 'select_account',
          ...(process.env.GOOGLE_WORKSPACE_DOMAIN ? { hd: process.env.GOOGLE_WORKSPACE_DOMAIN } : {}),
        },
      },
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        await dbConnect()
        const user = await UserModel.findOne({ email: credentials.email.toLowerCase() })
        if (!user || !user.password) return null

        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null

        return { id: user._id.toString(), name: user.name, email: user.email, image: user.image }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        const allowedDomain = process.env.GOOGLE_WORKSPACE_DOMAIN
        if (allowedDomain) {
          const hostedDomain = (profile as { hd?: string })?.hd
          if (hostedDomain !== allowedDomain) return false
        }

        await dbConnect()
        const isFirst = (await UserModel.countDocuments()) === 0
        const doc = await UserModel.findOneAndUpdate(
          { email: user.email!.toLowerCase() },
          {
            $setOnInsert: {
              name: user.name!,
              email: user.email!.toLowerCase(),
              provider: 'google',
              role: isFirst ? 'admin' : 'viewer',
            },
            $set: { image: user.image },
          },
          { upsert: true, new: true }
        )
        user.role = doc.role
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      // Refresh role from DB on each token refresh so role changes take effect immediately.
      // Use email (always present in token) to avoid Mongoose CastError from Google sub IDs.
      if (token.email && !user) {
        try {
          await dbConnect()
          const doc = await UserModel.findOne({ email: token.email }).select('_id role').lean() as { _id: { toString(): string }, role?: string } | null
          if (doc) {
            token.id = doc._id.toString()
            token.role = (doc.role as 'admin' | 'viewer' | undefined) ?? 'viewer'
          }
        } catch {
          // Non-fatal — keep whatever role is already in the token
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role ?? 'viewer'
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
