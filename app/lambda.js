require('dotenv').config();
const serverlessExpress = require('@vendia/serverless-express')
const { App, ExpressReceiver } = require("@slack/bolt");
const multiparty = require("multiparty");
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

app.event("app_mention", async ({ event, client, say }) => {
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

    } catch (e) {
        console.log("error", e)
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

    // Chat completions APIを呼ぶ
    const response = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [
            {
                role: ChatCompletionRequestMessageRoleEnum.System,
                content: "あなたは有能なアシスタントです。",
            },
            ...mentionMessages,
        ],
    });
    const message = response.data.choices[0].message?.content;
    return message
}

if (process.env.IS_LOCAL === "true") {
    // ローカル起動時に実行するコード
    (async () => {
        await app.start(process.env.PORT || 3000);
        console.log("⚡️ Bolt app is running!");
    })();
} else {
    // AWS Lambdaで実行されるコード
    app.receiver.router.post("/slack/events", async (req, res) => {
        const { type, challenge } = req.body;
        if (type === 'url_verification') {
            // 初回はURL Verification（サーバの存在確認用）のリクエストがきますので、それに対応するコード
            // See. https://api.slack.com/apis/connections/events-api#the-events-api__subscribing-to-event-types__events-api-request-urls__request-url-configuration--verification
            res.send(challenge);
        } else {
            console.log(req.body);
            res.sendStatus(200);
        }
    });

    const server = serverlessExpress.createServer(expressReceiver.app)
    exports.handler = (event, context) => serverlessExpress.proxy(server, event, context)
}
