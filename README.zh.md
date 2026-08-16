# @haibala-aii/dsh-extensions-wallpaperskin

[English](README.md) | 中文

这是一个用于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 界面的壁纸皮肤插件。它会读取本机 Wallpaper Engine 媒体，在 **扩展 > 外部** 中提供壁纸选择弹窗，并通过可调透明底色让壁纸显示在 DSH 工作区后方。

> [!IMPORTANT]
> 图片项目使用原图，视频项目播放本机原始视频。兼容的 `scene.pkg` 项目会读取包内主纹理。Wallpaper Engine 粒子、SceneScript、骨骼动画、音频响应和网页壁纸暂不执行；不兼容项目保留预览图。

## 功能

- 通过 `STEAM_PATH`、Steam 注册表项和常见安装目录发现 Windows 上的 Steam 库。
- 扫描 Wallpaper Engine 创意工坊订阅内容和本地创建项目。
- 使用浏览器原生能力静音循环播放 MP4、WebM、M4V 和 MOV。
- 读取 PKGV 场景包，并解码 PNG、JPEG、BMP、原始 BGRA 和 RLE 压缩的 TEX 主纹理。
- 从 **扩展 > 外部** 的 `extensions-wallpaperskin` 已安装项目打开，不占用设置页。
- 用“本地库”和“Wallpaper Engine”两个 Tab 区分全部项目与创意工坊缓存。
- 点击卡片和调整透明度只会暂存，按“应用壁纸”后才写入配置。
- 关闭弹窗或按“恢复当前选择”会恢复已保存的壁纸和透明度。
- 把本机原图、视频或兼容场景媒体作为全窗口 `cover` 背景，并让 DSH 主界面和侧边栏保持可读。
- 提供 `0-70%` 的界面底色透明度。默认值为 `36%`；侧边栏比主底色少透明 14 个百分点，避免导航文字难以辨认。
- 壁纸文件保留在本机，只由本地 DSH Host 提供给浏览器界面。

## 使用条件

- Windows。当前自动发现逻辑使用 Windows 注册表和盘符目录。
- 带 Web profile 的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)。
- Node.js `^22.19.0` 或 `>=24.0.0`，与插件包的 engines 声明一致。
- 使用创意工坊或本地项目扫描时需要 Wallpaper Engine。没有安装 Wallpaper Engine 时插件仍可加载，但壁纸列表为空。

如果 Steam 安装在非常规位置，请在启动 DSH 前把 `STEAM_PATH` 设置为 Steam 根目录。

## 安装

从 GitHub 直接安装到 DSH 的 web profile：

```sh
dsh plugin --profile web add github:haibala-aii/dsh-extensions-wallpaperskin
```

安装完成后重启 Web 界面：

```sh
dsh web
```

本地开发时，可以克隆仓库并链接仓库根目录：

```sh
git clone https://github.com/haibala-aii/dsh-extensions-wallpaperskin.git
dsh plugin --profile web add link:E:/path/to/dsh-extensions-wallpaperskin
```

仓库根目录就是可安装插件包，不再包含第二层插件目录。

## 使用方法

1. 打开 DSH，进入 **扩展 > 外部**。
2. 点击 `@haibala-aii/dsh-extensions-wallpaperskin` 对应的 `extensions-wallpaperskin` 项目。
3. “本地库”显示发现的全部项目；“Wallpaper Engine”显示已经同步到本机的创意工坊项目。需要更多壁纸时，可以通过弹窗中的入口打开 Steam 创意工坊。
4. 通过卡片标签区分“原图”“视频”“场景主纹理”和“仅预览”，然后点击一张壁纸。此时只会预选，不会立即保存。
5. 调整“界面底色透明度”，实时观察壁纸透过 DSH 主底色的程度。
6. 按“应用壁纸”，同时保存壁纸和透明度。

未应用时直接关闭弹窗，会恢复上次保存的状态。“恢复当前选择”也会丢弃本次预选和透明度调整。“关闭壁纸”只移除 DSH 背景，不会删除 Wallpaper Engine 文件。

## 扫描目录

Host 会在每个已发现的 Steam 库中扫描：

```text
steamapps/workshop/content/431960
steamapps/common/wallpaper_engine/projects/myprojects
```

存在 `project.json` 时，扫描器会读取项目元数据。图片项目使用声明的原图；视频项目使用声明的视频，或项目目录中的第一个受支持视频；场景项目读取 `scene.pkg` 中的 `scene.json`、模型和材质元数据，以定位 TEX 主纹理。预览文件只用作缩略图和运行失败时的回退图。

支持的图片扩展名为 PNG、JPEG、GIF、WebP、BMP、SVG 和 AVIF。支持的视频容器为 MP4、WebM、M4V 和 MOV；视频能否播放仍取决于浏览器支持的编码格式。

“Wallpaper Engine”Tab 只展示已经下载到本机的创意工坊文件，插件不会自行下载创意工坊内容。请先在 Wallpaper Engine 中订阅或创建壁纸，等待同步完成，再在弹窗中按“扫描本地库”。

## 配置

配置保存在 `$DSH_HOME/wallpaperskin.json`。未设置 `DSH_HOME` 时使用 DSH 默认目录 `~/.dsh`。保存后的格式如下：

```json
{
  "enabled": true,
  "selectedId": "workshop/1234567890",
  "surfaceTransparency": 36
}
```

`surfaceTransparency` 是 `0` 到 `70` 的整数。`0` 表示 DSH 主底色不透明，数值越大，壁纸越明显。缺少该字段或值无效时，Client 使用默认值 `36`。

## Host API

浏览器 Client 使用以下本地接口：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/plugins/wallpaperskin/list` | 重新扫描并返回壁纸、Steam 库根目录和已保存配置 |
| `GET` | `/plugins/wallpaperskin/preview/<id>` | 返回壁纸缩略图 |
| `GET` | `/plugins/wallpaperskin/image/<id>` | 返回选中的背景图 |
| `GET` | `/plugins/wallpaperskin/media/<id>` | 返回原图、支持 Range 的视频流或解码后的场景纹理 |
| `GET` | `/plugins/wallpaperskin/config` | 返回已保存配置 |
| `POST` | `/plugins/wallpaperskin/config` | 合并并保存配置字段 |
| `GET` | `/plugins/wallpaperskin/health` | 返回插件状态和渲染模式 |

这些接口面向本地 DSH Web Client，不是带身份验证的公共图片服务。请按照 DSH 其他本地文件能力的标准限制实例的网络访问范围。

## 架构

插件包包含两个运行部分：

- `lib/index.js` 是 Host 插件，负责发现 Steam 库、选择项目原始媒体、提供视频 Range 响应和 HTTP 接口，并持久化配置。
- `lib/scene-package.js` 负责校验 PKGV 目录、解析场景元数据，并在不写入磁盘的情况下解码最大尺寸 TEX 纹理。
- `lib/client.js` 是浏览器插件，负责注册扩展弹层、渲染选择器、预览未保存的调整，以及设置图片或视频背景和 DSH 半透明主题变量。

`cordis.patch.yml` 把 Host 插件插入指定 DSH profile；`package.json` 中的 `dsh.client` 字段负责注册浏览器 Client。

## 隐私与安全

插件不会上传壁纸、发送遥测数据或请求远程壁纸 API。壁纸元数据、包内纹理和视频内容都留在本机，由本地 DSH Host 读取。唯一的外部跳转是用户主动点击的 Wallpaper Engine 公共创意工坊链接。

DSH 会把选中的媒体提供给已连接的 Web Client。不要把未做访问控制的 DSH 实例暴露到不受信任的网络，因为能够访问插件路由的 Client 可以按 id 请求已发现的壁纸媒体。

漏洞报告方式见 [SECURITY.md](SECURITY.md)。

## 开发

插件不需要构建步骤。修改 `lib/` 中的 ESM 源文件后运行：

```sh
npm run check
npm pack --dry-run
```

需要验证实际交互时，把本地仓库链接到一个测试用 web profile，重启 `dsh web`，依次检查选择、预览、应用、恢复和关闭壁纸流程。

欢迎参与开发。提交前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，查看[现有 Issue](https://github.com/haibala-aii/dsh-extensions-wallpaperskin/issues)，并为行为变化提供针对性的验证说明。

## 项目标识

- Cordis 行 id：`wallpaperskin`
- 包名：`@haibala-aii/dsh-extensions-wallpaperskin`
- 浏览器扩展项：`extensions-wallpaperskin`
- Host 路由前缀：`/plugins/wallpaperskin`

## 开源许可

项目使用 [MIT License](LICENSE) 开源。
