import { App, ExpressReceiver } from '@slack/bolt'
import {
  Configuration,
  OpenAIApi,
  ChatCompletionRequestMessageRoleEnum,
} from 'openai'
import { AppOptions } from '@slack/bolt/dist/App'
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET || ''
const slackBotToken = process.env.SLACK_BOT_TOKEN || ''
const slackAppToken = process.env.SLACK_APP_TOKEN || ''
const slackBotId = process.env.SLACK_BOT_ID || ''
const openaiSecret = process.env.OPENAPI_SECRET || ''

const expressReceiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET || '',
  processBeforeResponse: true,
})
let app = new App({
  token: slackBotToken,
  receiver: expressReceiver,
})
if (process.env.IS_LOCAL === 'true') {
  // ローカルはソケットを利用して接続する
  app = new App({
    signingSecret: slackSigningSecret,
    token: slackBotToken,
    appToken: slackAppToken,
    socketMode: true,
    port: 3000,
  } as AppOptions)
}

// global middleware。すべての event action command の前に実行される。
app.use(async ({ context, next }) => {
  // リトライされたイベントであればスキップすべきかどうか判断する
  if (context.retryNum) {
    console.log('Retry Skip', context.retryNum)
    return
  }
  await next()
})

// すべてのメッセージを受け取る
app.message(async ({ event, client, message, say }) => {
  // スレッドのトップのメッセージであればthread_ts、スレッド中のメッセージであればtsを取得する。
  const threadTs =
    'thread_ts' in event && event.thread_ts ? event.thread_ts : event.ts
  const user = 'user' in event && event.user

  try {
    if (!user) {
      throw new Error('An unexpected error occurred.')
    }
    const isMentionedBot =
      'text' in message && message.text.includes(`<@${slackBotId}>`)
    const isDM = message.channel_type === 'im'
    if (!isMentionedBot && !isDM) {
      // bot宛のメンションがない場合、botのDMでない場合は何もしない
      return
    }

    // スレッドのメッセージをすべて取得
    const threadMessagesResponse = await client.conversations.replies({
      channel: event.channel,
      ts: threadTs,
    })
    const threadMessages = threadMessagesResponse.messages
    if (!threadMessages) {
      throw new Error('An unexpected error occurred.')
    }

    // OpenAI APIに渡すためのメッセージオブジェクトを作成する。
    const mentionMessages: Record<never, never>[] = threadMessages
      .map((message) => {
        const role =
          message.user === slackBotId
            ? ChatCompletionRequestMessageRoleEnum.Assistant
            : ChatCompletionRequestMessageRoleEnum.User
        return { role: role, content: message.text }
      })
      .filter((e) => e) // undefinedを除く

    // OpenAIにリクエストします
    const reply = await callOpenai(mentionMessages)

    // Slack APIを呼んで回答を送信
    await say({
      text: `<@${user}>\n ${reply}`,
      thread_ts: threadTs,
    })
  } catch (e) {
    console.log('error', e)
    await say({
      text: `<@${user}>\n 不具合が発生しました。開発者にお問い合わせください。`,
      thread_ts: threadTs,
    })
  }
})

// OpenAIにリクエストします。
const callOpenai = async (mentionMessages: Record<never, never>[]) => {
  const configuration = new Configuration({
    apiKey: openaiSecret,
  })
  const openai = new OpenAIApi(configuration)
  const messages = [
    {
      role: ChatCompletionRequestMessageRoleEnum.System,
      content: 'あなたは有能なアシスタントです。',
    },
    ...mentionMessages,
  ]
  console.log('request to openai:', messages)
  // Chat completions APIを呼ぶ
  const response = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    // @ts-ignore
    messages,
  })
  const message = response.data.choices[0]?.message?.content
  console.log('response from openai:', message)
  return message
}

export { app, expressReceiver }
