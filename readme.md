
A small tool to help you cconvert PSS videos for PlayStation 2 games.

*   **Convert to PSS:** Convert standard video files (like MP4, MKV) from your PC into the PSS format that PS2 games can use.
*   **Convert to MP4:** Convert PSS files from a game back into MP4, making them easy to watch and edit.
*   **Adjustable Quality:** If your final PSS file is too large, you can lower the video bitrate or resolution in the tool to reduce its size.
*   **Automatic Freeze Fix:** Automatically checks for and adds a sequence end code to the M2V video. This is a key fix that prevents the final PSS from freezing on its last frame when played in-game.

I've tested this on a bunch of PS2 games, and it works pretty well most of the time. However, some games use special PSS files, like those with multiple audio tracks, and this tool probably won't be able to handle those. If a conversion fails, you'll likely have to dig into the official PS2 SDK documentation for more info.

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