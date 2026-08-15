# DSH Extensions WallpaperSkin

DeepSeek Harness (DSH) 壁纸皮肤插件扩展仓库。

> 当前为项目骨架，插件包位于 [`wallpaperskin/`](wallpaperskin/)，后续通过 `dsh plugin add` 安装。

## 仓库结构

```
dsh-extensions-wallpaperskin/
├── wallpaperskin/          # 可安装插件包
│   ├── package.json        # @haibala/dsh-wallpaperskin 包声明
│   ├── cordis.patch.yml    # DSH bundle patch（插件行 id: wallpaperskin）
│   ├── lib/index.js        # Host 半区：Node 路由 / 服务
│   ├── lib/client.js       # Client 半区：浏览器壁纸引擎 / 设置页
│   └── README.md
├── LICENSE                 # MIT
└── README.md
```

## 开发

```powershell
# 本地安装（开发调试，仅本机）
dsh plugin --profile web add E:\dsh-extensions-wallpaperskin\wallpaperskin

# 重启 DSH web 生效
dsh web
```

## 发布

插件包发布到 npm：

```powershell
cd wallpaperskin
npm publish --access public
```

## License

[MIT](LICENSE)
