
const { App, ExpressReceiver } = require("@slack/bolt");
const { Configuration, OpenAIApi, ChatCompletionRequestMessageRoleEnum } = require("openai");

const accessToken = process.env.SLACK_BOT_TOKEN

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
    if (context.retryNum && shouldSkip(contenxt)) {
        console.log("Retry Skip", context.retryNum);
        return;
    }
    await next();
})

app.event("app_mention", async ({ event, client, say }) => {
    console.log("app_mention start");

    // スレッドのトップのメッセージであればthread_ts、スレッド中のメッセージであればtsを取得する。
    const threadTs = event.thread_ts ? event.thread_ts : event.ts;
    try {
        // スレッドのメッセージを取得
        const threadMessagesResponse = await client.conversations.replies({
            channel: event.channel,
            ts: threadTs,
        });
        const threadMessages = threadMessagesResponse.messages

        const slackBotId = process.env.SLACK_BOT_ID;

        // OpenAI APIに渡すためのメッセージオブジェクトを作成する。
        const mentionMessages =
            threadMessages.map(message => {
                // メンション付きのものだけを抽出する。ここら辺は好み。
                if(message.text?.includes(`<@${slackBotId}>`) || message.text?.includes(`<@${message.user}>`)){
                    const role = message.user === slackBotId ? ChatCompletionRequestMessageRoleEnum.Assistant : ChatCompletionRequestMessageRoleEnum.User
                    return { role: role, content: message.text }
                };
            }).filter(e => e) // undefinedを除く

        // OpenAIにリクエストします
        const message = await callOpenai(mentionMessages);

        // Slack APIを呼んで回答を送信
        await say(
            {
                text:`<@${event.user}>\n ${message}`,
                thread_ts:　threadTs
            }
        );

        console.log("app_mention success");
    } catch (e) {
        console.log("app_mention error", e.message);
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

module.exports = {
    app,
    expressReceiver
}
