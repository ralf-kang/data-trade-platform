import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Admin Login',
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        otp: { label: "2FA OTP (이메일로 전송됨)", type: "text" }
      },
      async authorize(credentials) {
        // TODO: Validate against Elasticsearch AdminIndex
        // 1. Check ID/PW
        // 2. If OTP is provided, verify it. If not, trigger 2FA email and return null/error asking for OTP.
        
        if (credentials?.username === 'admin' && credentials?.password === 'password') {
          // Dummy logic for demonstration
          if (credentials.otp === '123456') {
            return { id: '1', name: 'Admin User', email: 'admin@example.com', role: 'ADMIN' };
          } else {
            throw new Error('Invalid OTP');
          }
        }
        return null;
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
      }
      return session;
    }
  },
  pages: {
    signIn: '/admin/login',
  }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
