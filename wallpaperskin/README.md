# @haibala/dsh-wallpaperskin

DeepSeek Harness (DSH) 壁纸皮肤插件。

## 安装

```powershell
dsh plugin --profile web add @haibala/dsh-wallpaperskin
# 或从 GitHub 安装
dsh plugin --profile web add github:haibala-aii/dsh-extensions-wallpaperskin
```

重启 `dsh web` 后，在 **设置 → 壁纸皮肤** 中查看。

## 开发

```powershell
# 本地路径安装
dsh plugin --profile web add E:\dsh-extensions-wallpaperskin\wallpaperskin
dsh web
```

## 插件标识

- 行 id：`wallpaperskin`
- 包名：`@haibala/dsh-wallpaperskin`
- Host 路由前缀：`/plugins/wallpaperskin`
- 设置页槽位：`settings.section`（id: `wallpaperskin`）

## 计划功能

- [ ] 自定义壁纸图片 / 文件夹扫描
- [ ] 壁纸轮换与过渡动效
- [ ] 背景透明度、毛玻璃模糊、压暗、文字阴影
- [ ] 配置持久化（`$DSH_HOME/wallpaperskin.json`）

## License

MIT
