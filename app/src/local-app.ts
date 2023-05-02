import 'dotenv/config.js'
import { app } from './app.js'

// ローカル起動時に実行するコード
;(async () => {
  await app.start(process.env.PORT || 3000)
  console.log('listening')
})()
