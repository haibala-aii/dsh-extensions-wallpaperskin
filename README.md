# DSH Extensions WallpaperSkin

DeepSeek Harness (DSH) 壁纸皮肤插件。

> 当前版本：**静态图片版 MVP**
> 功能：扫描本地 Wallpaper Engine 壁纸库，在 DSH 设置页选择静态壁纸，自动铺满并适配窗口大小。

## 仓库结构

```
dsh-extensions-wallpaperskin/
├── wallpaperskin/          # 可安装插件包
│   ├── package.json        # @haibala/dsh-wallpaperskin
│   ├── cordis.patch.yml    # DSH bundle patch（插件行 id: wallpaperskin）
│   ├── lib/index.js        # Host 半区：WE 壁纸库扫描 / 图片服务 / 配置
│   ├── lib/client.js       # Client 半区：壁纸选择界面 + 背景应用
│   └── README.md
├── LICENSE                 # MIT
└── README.md
```

## 功能

- 自动发现本地 Steam / Wallpaper Engine 壁纸库
- 扫描创意工坊 `steamapps/workshop/content/431960` 与 `projects/myprojects`、`projects/defaultprojects`
- 以静态预览图作为壁纸（当前仅静态图片，视频/场景壁纸先用预览图展示）
- DSH 设置页新增“壁纸皮肤”独立界面，网格选择壁纸
- 背景自动 `cover` 铺满窗口，适配窗口大小
- 配置持久化到 `$DSH_HOME/wallpaperskin.json`

## 安装

```powershell
# 本地开发安装
dsh plugin --profile web add E:\dsh-extensions-wallpaperskin\wallpaperskin

# 重启 DSH web 生效
dsh web
```

## 开发

```powershell
# 语法检查
node --check wallpaperskin/lib/index.js
node --check wallpaperskin/lib/client.js

# 本地安装后打开 DSH 设置 → 壁纸皮肤
```

## 发布

插件包发布到 npm：

```powershell
cd wallpaperskin
npm publish --access public
```

## License

[MIT](LICENSE)
