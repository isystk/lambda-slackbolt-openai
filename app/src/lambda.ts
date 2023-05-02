import serverlessExpress from '@vendia/serverless-express'
import { app, expressReceiver } from './app'

// 初回はURL Verification（サーバの存在確認用）のリクエストがきますので、それに対応するコード
// See. https://api.slack.com/apis/connections/events-api#the-events-api__subscribing-to-event-types__events-api-request-urls__request-url-configuration--verification
// @ts-ignore
app.receiver.router.post('/slack/events', async (req, res) => {
  const { type, challenge } = req.body
  if (type === 'url_verification') {
    console.log('Verification Success')
    res.send(challenge)
  } else {
    console.log(req.body)
    res.sendStatus(200)
  }
})

exports.handler = serverlessExpress({ app: expressReceiver.app })
