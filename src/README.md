# NS 脚本模块说明

位置：`src/meta.js`。动作：保存油猴脚本头。

位置：`src/core/`。动作：保存入口、样式、同步、面板和启动逻辑。

位置：`src/modules/`。动作：保存黑名单、好友、历史、过滤、快捷回复、图床、签到、统计和笔记逻辑。

位置：`src/module-order.json`。动作：控制合并顺序。

位置：`scripts/build.js`。动作：合并模块。

结果：执行 `npm run build` 后生成根目录 `Ns.js`。
