# PSSpectrum - PS2 PSS 视频转换器

使用 Wails 构建的现代化 GUI 工具，用于在 PS2 PSS 视频格式和标准 MP4 视频之间进行转换。

## 功能特性

- **转换为 PSS：** 将标准视频文件（MP4、MKV、AVI、MOV）转换为 PS2 PSS 格式
- **转换为 MP4：** 将 PSS 文件转换回 MP4，便于观看和编辑
- **可调节质量：** 配置视频分辨率和比特率以控制文件大小
- **自动修复冻结：** 自动添加序列结束码以防止视频冻结
- **现代化界面：** 受复古游戏美学启发的漂亮 CRT 风格界面
- **实时日志：** 通过详细日志监控转换进度

## 系统要求

以下可执行文件必须与编译后的程序放在同一目录中：

```
PSSpectrum/
├─ bin/
│  ├─ ps2str.exe
│  └─ vgmstream-cli.exe
├─ ffmpeg.exe
└─ PSSpectrum.exe
```

## 构建

### 前置要求

- Go 1.21 或更高版本
- Node.js 16+ 和 npm
- Wails CLI v2: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`

### 开发模式

```bash
cd PSSpectrum-Wails
wails dev
```

### 生产构建

```bash
cd PSSpectrum-Wails
wails build
```

编译后的可执行文件将位于 `build/bin` 目录中。

## 使用方法

1. 启动 PSSpectrum
2. 选择转换方向（MP4 → PSS 或 PSS → MP4）
3. 选择输入文件
4. 配置设置（用于 MP4 → PSS 转换）
5. 选择输出位置
6. 点击转换并在日志中监控进度

### MP4 转 PSS 设置

- **分辨率：** 默认 640x448（根据需要调整）
- **比特率：** 默认 8000 kbps（降低以获得更小的文件）
- **保留中间文件：** 可选，用于调试

### 重要提示

- 避免在文件路径中使用中文字符
- 某些特殊的 PSS 文件（例如多音轨）可能不受支持
- 如果转换失败，请检查日志以获取详细的错误消息

## 致谢

本工具的实现离不开以下项目：

- **FFMPEG** - 视频/音频处理
- **VGMSTREAM** - 音频格式转换
- **PS2STR** - PSS 复用/解复用（SCE 版权软件）
- **Wails** - Go + Web 前端框架
- **RewindPS4** - UI 设计灵感来源

## 许可证

请注意，PS2STR 是属于索尼计算机娱乐（SCE）的版权软件。

## 原始 Python 版本

这是原始 wxPython 版本的 Wails 移植版。原始版本可在以下位置找到：
https://github.com/Ailyth99/PSSpectrum
