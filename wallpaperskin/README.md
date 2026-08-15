# @haibala/dsh-wallpaperskin

DeepSeek Harness (DSH) 壁纸皮肤插件 —— **静态图片版 MVP**。

## 功能

- 扫描本地 Wallpaper Engine 壁纸库（创意工坊 + 本地项目）
- 在 DSH **设置 → 壁纸皮肤** 中打开独立选择界面
- 点击壁纸卡片后应用为 DSH 背景，自动铺满并适配窗口大小
- 配置持久化到 `$DSH_HOME/wallpaperskin.json`

## 安装

```powershell
dsh plugin --profile web add @haibala/dsh-wallpaperskin
# 或从 GitHub 安装
dsh plugin --profile web add github:haibala-aii/dsh-extensions-wallpaperskin
```

重启 `dsh web` 后，打开 **设置 → 壁纸皮肤**。

## 插件标识

- 行 id：`wallpaperskin`
- 包名：`@haibala/dsh-wallpaperskin`
- Host 路由前缀：`/plugins/wallpaperskin`
- 设置页槽位：`settings.section`（id: `wallpaperskin`）

## Host API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/plugins/wallpaperskin/list` | 返回可用壁纸列表 |
| GET | `/plugins/wallpaperskin/preview/<id>` | 壁纸预览图（缩略图） |
| GET | `/plugins/wallpaperskin/image/<id>` | 壁纸静态背景图 |
| GET | `/plugins/wallpaperskin/config` | 读取当前配置 |
| POST | `/plugins/wallpaperskin/config` | 保存当前选择 |

## 已知限制

- 当前只使用 Wallpaper Engine 的 **静态预览图** 作为背景
- `scene.pkg` 场景壁纸无法在 DSH 中原样动态渲染
- 视频/网页壁纸当前同样只使用预览图，后续版本再做动态支持

## Roadmap

- [x] 本地 WE 壁纸库扫描
- [x] 独立选择界面 + 静态图片应用
- [ ] 视频壁纸动态播放
- [ ] Web 壁纸兼容
- [ ] `scene.pkg` 素材提取
- [ ] GitHub 壁纸商城

## License

MIT
