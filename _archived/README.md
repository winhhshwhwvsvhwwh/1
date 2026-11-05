# 已归档页面（当前版本不使用）

产品改为「只保留AI咨询一个入口」后，以下4个原tab页面不再可达，已从 `pages/` 移到这里，没有删除：

- `pages/index`（首页）
- `pages/assessment`（AI评估）
- `pages/report`（AI报告）
- `pages/member`（会员中心）

本目录已在 `project.config.json` 的 `packOptions.ignore` 里排除，不会进入上传包。

## 如何恢复
1. 把需要的页面文件夹从 `_archived/pages/` 移回 `pages/`
2. 在 `app.json` 的 `pages` 里重新注册；如果要恢复tab栏，再加回 `tabBar`
3. 页面里的 `require('../../utils/...')` 相对路径移回后即可正常使用
