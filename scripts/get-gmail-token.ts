import { google } from 'googleapis'
import readline from 'readline'

const REDIRECT_URI = 'http://localhost:9999'

const auth = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  REDIRECT_URI,
)

const url = auth.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',   // force refresh_token to be returned every time
  scope: ['https://www.googleapis.com/auth/gmail.modify'],
})

console.log('1. Open this URL in your browser:\n', url)
console.log('\n2. After authorizing, Google will redirect to http://localhost:3000/?code=...&...')
console.log('   The page will fail to load — that is expected.')
console.log('   Copy the value of the "code" parameter from the URL bar.\n')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.question('3. Paste the code here: ', async (code) => {
  const { tokens } = await auth.getToken(code.trim())
  console.log('\nRefresh token:', tokens.refresh_token)
  console.log('\nUpdate GMAIL_REFRESH_TOKEN in your .env with this value.')
  rl.close()
})
