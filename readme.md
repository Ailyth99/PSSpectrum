
A small tool to help you cconvert PSS videos for PlayStation 2 games.

*   **Convert to PSS:** Convert standard video files (like MP4, MKV) from your PC into the PSS format that PS2 games can use.
*   **Convert to MP4:** Convert PSS files from a game back into MP4, making them easy to watch and edit.
*   **Adjustable Quality:** If your final PSS file is too large, you can lower the video bitrate or resolution in the tool to reduce its size.

I've tested this on a bunch of PS2 games, and it works pretty well most of the time. However, some games use special PSS files, like those with multiple audio tracks, and this tool probably won't be able to handle those. If a conversion fails, you'll likely have to dig into the official PS2 SDK documentation for more info.

Note: Some injected PSS files may play normally but freeze on the last frame. This happens because the game internally records the file size of the original PSS. If the new PSS size does not match this recorded value, it causes a conflict and the game hangs. To fix this, you need to locate where the game stores the original file size and update it to match the file size (in bytes) of your new PSS.

###  How to Use

![](https://pic1.imgdb.cn/item/696cd422e8f4cc17ae672aa6.png)

```
PSSpectrum/
├─ bin/
│  ├─ ps2str.exe
│  └─ vgmstream-cli.exe
│
├─ ffmpeg.exe
└─ main program
```


###  Build

Prerequisites

- Go 1.21 or higher
- Node.js and npm
- Wails CLI v2: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`

```bash
cd 
wails build
```

注意，路径及文件名别带中文字符，否则必报错

### 🙏 Credits

This tool wouldn't be possible without the great work from:
-   FFMPEG
-   VGMSTREAM
-   PS2STR (Note: This is copyrighted software belonging to SCE. Please be mindful of this when using it.)