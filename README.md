🌙 lambda-slackbolt-openai
====

![GitHub issues](https://img.shields.io/github/issues/isystk/lambda-slackbolt-openai)
![GitHub forks](https://img.shields.io/github/forks/isystk/lambda-slackbolt-openai)
![GitHub stars](https://img.shields.io/github/stars/isystk/lambda-slackbolt-openai)
![GitHub license](https://img.shields.io/github/license/isystk/lambda-slackbolt-openai)

## 📗 プロジェクトの概要

Slackから「＠ChatGPTBot こんにちわ」のようにメンションをつけて投稿すると
ChatGPTがスレッドに返信してくれるアプリケーションです。
AWS-Lambdaで動作しています。SAMを利用して自動デプロイ可能です。
ローカル環境では、Slack側からAPIアクセスが出来ないのでソケットモードで接続するようにしています。

## 🌐 Demo

![デモ](./demo.png "デモ")

## 📦 ディレクトリ構造

```
.
├── README.md
├── app (Lambdaのモジュール)
│   ├── lambda.js
│   ├── package-lock.json
│   ├── package.json
│   └── tests
├── layers (共通モジュール)
│   └── app-layer
├── samconfig.toml
└── template.yaml
```

## 🔧 開発環境の構築

IAM ユーザーを用意する
```
ユーザ名：「lambda-user」
アクセス権限：
「AdministratorAccess」
```

SAM CLI をインストールする
```
$ pip install aws-sam-cli
```

AWSにアクセスする為の設定を作成する
```
$ aws configure --profile lambda-user 
AWS Access Key ID [None]: xxxxxxxxxx
AWS Secret Access Key [None]: xxxxxxxxxx
Default region name [None]: ap-northeast-1
Default output format [None]: json
```

Slackアプリを作成する

https://api.slack.com/apps

![Event Subscriptions](./slack_app.png "Event Subscriptions")
※ ローカルで動かしたい場合は、「Enable Socket Mode」を有効にしてください。

## 💬 使い方

ローカルでAPIを起動する
```
# cd app
$ npm install
$ npm run start
```

AWS にデプロイする
```
# ビルドを実行する（.aws-samディレクトリに生成される）
$ sam build
# AWSに反映する
$ sam deploy --config-env stg

# AWSから、DynamoDB、Lambda&APIGatewayを削除する
$ sam delete --stack-name lambda-slackbolt-openai --profile lambda-user
```

## 🎨 参考

| プロジェクト| 概要|
| :---------------------------------------| :-------------------------------|
| [ChatGPT (OpenAI) を AWS Lambda / Slack 上で動かす](https://blog.nekohack.me/posts/chatgpt-slack)| ChatGPT (OpenAI) を AWS Lambda / Slack 上で動かす |
| [【30分で完成】オウム返しBotから始めるSlackアプリの作り方](https://www.pci-sol.com/business/service/product/blog/lets-make-slack-app/)| 【30分で完成】オウム返しBotから始めるSlackアプリの作り方 |


## 🎫 Licence

[MIT](https://github.com/isystk/lambda-slackbolt-openai/blob/master/LICENSE)

## 👀 Author

[isystk](https://github.com/isystk)
