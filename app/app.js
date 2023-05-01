import Bolt from "@slack/bolt";
const { App, ExpressReceiver } = Bolt
import { Configuration, OpenAIApi, ChatCompletionRequestMessageRoleEnum } from "openai";
const accessToken = process.env.SLACK_BOT_TOKEN
const slackBotId = process.env.SLACK_BOT_ID;

const expressReceiver = new ExpressReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET ,
    processBeforeResponse: true,
});
let app = new App({
    token: accessToken,
    receiver: expressReceiver,
});
if (process.env.IS_LOCAL === "true") {
    // ローカルはソケットを利用して接続する
    app = new App({
        signingSecret: process.env.SLACK_SIGNING_SECRET,
        token: process.env.SLACK_BOT_TOKEN,
        appToken: process.env.SLACK_APP_TOKEN,
        socketMode: true,
        port: process.env.PORT || 3000,
    })
}

// global middleware。すべての event action command の前に実行される。
app.use(async ({ context, next }) => {
    // リトライされたイベントであればスキップすべきかどうか判断する
    if (context.retryNum) {
        console.log("Retry Skip", context.retryNum);
        return;
    }
    await next();
})

// すべてのメッセージを受け取る
app.message(async ({ event, client, message, say }) => {
    console.log("start");

    // スレッドのトップのメッセージであればthread_ts、スレッド中のメッセージであればtsを取得する。
    const threadTs = event.thread_ts ? event.thread_ts : event.ts;
    try {
        const isMentionedBot = message.text.includes(`<@${slackBotId}>`);
        const isDM = message.channel_type === 'im';
        if (!isMentionedBot && !isDM) {
            // bot宛のメンションがない場合、botのDMでない場合は何もしない
            return
        }
    
        // スレッドのメッセージをすべて取得
        const threadMessagesResponse = await client.conversations.replies({
            channel: event.channel,
            ts: threadTs,
        });
        const threadMessages = threadMessagesResponse.messages

        // OpenAI APIに渡すためのメッセージオブジェクトを作成する。
        const mentionMessages =
            threadMessages.map(message => {
                const role = message.user === slackBotId ? ChatCompletionRequestMessageRoleEnum.Assistant : ChatCompletionRequestMessageRoleEnum.User
                return { role: role, content: message.text }
            }).filter(e => e) // undefinedを除く

        // OpenAIにリクエストします
        const reply = await callOpenai(mentionMessages);

        // Slack APIを呼んで回答を送信
        await say(
            {
                text:`<@${event.user}>\n ${reply}`,
                thread_ts:　threadTs
            }
        );

        console.log("success");
    } catch (e) {
        console.log("error", e);
        await say(
            {
                text:`<@${event.user}>\n 不具合が発生しました。開発者にお問い合わせください。`,
                thread_ts: threadTs
            }
        );
    }
});

// OpenAIにリクエストします。
const callOpenai = async (mentionMessages) => {
    const configuration = new Configuration({
        apiKey: process.env.OPENAPI_SECRET
    });
    const openai = new OpenAIApi(configuration);
    const messages = [
        {
            role: ChatCompletionRequestMessageRoleEnum.System,
            content: "あなたは有能なアシスタントです。",
        },
        ...mentionMessages,
    ];
    console.log('request to openai:', messages)
    // Chat completions APIを呼ぶ
    const response = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages,
    });
    const message = response.data.choices[0].message?.content;
    console.log('response from openai:', message)
    return message
}

export {
    app,
    expressReceiver
}
