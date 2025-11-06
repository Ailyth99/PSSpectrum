This is a small tool to help you convert PSS videos for PlayStation 2 games.



It's designed to do two main things:

1\.  Convert standard video files (like MP4, MKV) from your PC into the PSS format that PS2 games can use.

2\.  Convert PSS files from a game back into MP4, making them easy to watch and edit.



If your final PSS file is too large, you can try lowering the video bitrate or resolution in the tool to reduce its size.



It also automatically checks for and adds a sequence end code to the M2V video. This is a key fix that prevents the final PSS from freezing on its last frame when played in-game.



I've tested this on a bunch of PS2 games, and it works pretty well most of the time. However, some games use special PSS files, like those with multiple audio tracks, and this tool probably won't be able to handle those. If a conversion fails, you'll likely have to dig into the official PS2 SDK documentation for more info.

![](https://pic1.imgdb.cn/item/690c14e33203f7be00daead5.png)

---

\#### \*\*How to Use It\*\*



```

PSSpectrum/

├─ bin/

│  ├─ ps2str.exe

│  └─ vgmstream-cli.exe

│

├─ ffmpeg.exe

└─ psspectrum.py```

---

\#### \*\*Credits\*\*



This tool wouldn't be possible without the great work from:

\-   FFMPEG

\-   VGMSTREAM

\-   PS2STR (Note: This is copyrighted software belonging to SCE. Please be mindful of this when using it.)

