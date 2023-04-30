require('dotenv').config();
const {app} = require("./app");

// ローカル起動時に実行するコード
(async () => {
    await app.start(process.env.PORT || 3000);
    console.log("⚡️ Bolt app is running!");
})();
