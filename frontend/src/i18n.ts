export const translations = {
  en: {
    // Tabs
    mp4ToPss: 'MP4 → PSS',
    mp4ToPssDesc: 'Convert video to PS2 format',
    pssToMp4: 'PSS → MP4',
    pssToMp4Desc: 'Convert PS2 video to MP4',
    
    // MP4 to PSS
    sourceVideoFile: 'Source Video File:',
    browse: 'Browse...',
    resolution: 'Resolution:',
    videoBitrate: 'Video Bitrate (kbps):',
    keepIntermediateFiles: 'Keep Intermediate Files',
    outputPssFile: 'Output PSS File:',
    saveAs: 'Save As...',
    convertToPss: 'Convert to PSS',
    converting: 'Converting...',
    
    // PSS to MP4
    sourcePssFile: 'Source PSS File:',
    keepIntermediateFilesMp4: 'Keep Intermediate Files (.m2v, .ads, .wav)',
    outputMp4File: 'Output MP4 File:',
    convertToMp4: 'Convert to MP4',
    
    // Log
    conversionLog: 'Conversion Log',
    noLogsYet: 'No logs yet. Start a conversion to see progress.',
    
    // Messages
    selectInputOutput: 'Please select input and output files!',
    invalidValues: 'Invalid resolution or bitrate values!',
    conversionSuccess: 'Conversion completed successfully!',
    conversionFailed: 'Conversion failed',
    missingDeps: 'Missing dependencies',
    checkLog: 'Please check the log for details.',
    
    // Log messages
    appTitle: 'PSSpectrum - PS2 PSS Video Converter v1.1 - Ailyth99',
    checkingDeps: 'https://github.com/Ailyth99/PSSpectrum',
    found: 'Found',
    missing: 'Missing',
    warningMissingDeps: '[WARNING] Missing dependencies:',
    placeDepsMsg: 'Please place required executables in the program directory.',
    ffmpegDownload: 'Download FFMPEG.EXE: https://www.ffmpeg.org/download.html',
    allDepsFound: 'All dependencies found. Ready to convert!',
    startingMp4ToPss: 'Starting MP4 to PSS conversion...',
    startingPssToMp4: 'Starting PSS to MP4 conversion...',
  },
  zh: {
    // 标签页
    mp4ToPss: 'MP4 → PSS',
    mp4ToPssDesc: '将视频转换为 PS2 格式',
    pssToMp4: 'PSS → MP4',
    pssToMp4Desc: '将 PS2 视频转换为 MP4',
    
    // MP4 转 PSS
    sourceVideoFile: '源视频文件：',
    browse: '浏览...',
    resolution: '分辨率：',
    videoBitrate: '视频比特率 (kbps)：',
    keepIntermediateFiles: '保留中间文件',
    outputPssFile: '输出 PSS 文件：',
    saveAs: '另存为...',
    convertToPss: '转换为 PSS',
    converting: '转换中...',
    
    // PSS 转 MP4
    sourcePssFile: '源 PSS 文件：',
    keepIntermediateFilesMp4: '保留中间文件 (.m2v, .ads, .wav)',
    outputMp4File: '输出 MP4 文件：',
    convertToMp4: '转换为 MP4',
    
    // 日志
    conversionLog: '转换日志',
    noLogsYet: '暂无日志。开始转换以查看进度。',
    
    // 消息
    selectInputOutput: '请选择输入和输出文件！',
    invalidValues: '分辨率或比特率值无效！',
    conversionSuccess: '转换成功完成！',
    conversionFailed: '转换失败',
    missingDeps: '缺少依赖项',
    checkLog: '请查看日志了解详情。',
    
    // 日志消息
    appTitle: 'PSSpectrum - PS2 PSS 视频转换器 v1.1 - aikika',
    checkingDeps: 'https://github.com/Ailyth99/PSSpectrum',
    found: '已找到',
    missing: '缺失',
    warningMissingDeps: '[警告] 缺少依赖项：',
    placeDepsMsg: '请将所需的可执行文件放在程序目录中。',
    ffmpegDownload: '下载 FFMPEG.EXE: https://www.ffmpeg.org/download.html',
    allDepsFound: '所有依赖项已找到。准备转换！',
    startingMp4ToPss: '开始 MP4 转 PSS 转换...',
    startingPssToMp4: '开始 PSS 转 MP4 转换...',
  }
};

export type Language = 'en' | 'zh';
