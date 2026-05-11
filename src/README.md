# NodeseekLite 源码说明

位置：`src/meta.js`。
动作：保存油猴脚本头。
结果：控制脚本名称、版本、更新地址和授权。

位置：`src/core/`。
动作：保存通用逻辑。
结果：包含入口、样式、主面板、设置、WebDAV、导入导出、启动流程和用户资料读取。

位置：`src/modules/`。
动作：保存独立功能。
结果：包含黑名单、好友、历史、关键词过滤、等级和加入天数屏蔽、快捷回复、图床、签到、统计和笔记。

位置：`src/module-order.json`。
动作：控制合并顺序。
结果：构建时按顺序写入单文件脚本。

位置：`scripts/build.js`。
动作：合并模块。
结果：执行 `npm run build` 或 `npm run check` 后生成根目录 `Ns.js` 和 `Ns.user.js`。
