import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import './custom.css';
import { SelectFile, SaveFile, CheckDependencies, ConvertToPSS, ConvertToMP4 } from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { translations, Language } from './i18n';
import baffle from 'baffle';

interface ConversionProgress {
  step: number;
  message: string;
  output: string;
  error?: string;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'mp4ToPss' | 'pssToMp4'>('mp4ToPss');
  
  // 自动检测系统语言
  const getSystemLanguage = (): Language => {
    const browserLang = navigator.language.toLowerCase();
    // 只有简体中文显示中文，其他全部英文
    return browserLang === 'zh-cn' || browserLang === 'zh' ? 'zh' : 'en';
  };
  
  const [language] = useState<Language>(getSystemLanguage());
  const t = translations[language];
  
  // MP4 to PSS state
  const [mp4Input, setMp4Input] = useState('');
  const [pssOutput, setPssOutput] = useState('');
  const [width, setWidth] = useState(640);
  const [height, setHeight] = useState(448);
  const [bitrate, setBitrate] = useState(8000);
  const [keepFilesPss, setKeepFilesPss] = useState(false);
  
  // PSS to MP4 state
  const [pssInput, setPssInput] = useState('');
  const [mp4Output, setMp4Output] = useState('');
  const [keepFilesMp4, setKeepFilesMp4] = useState(false);
  
  // Common state
  const [isConverting, setIsConverting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'warning' | 'info'>('info');
  
  const logRef = useRef<HTMLDivElement>(null);
  
  // Refs for tab text baffle animation
  const tab1TitleRef = useRef<HTMLHeadingElement>(null);
  const tab1DescRef = useRef<HTMLParagraphElement>(null);
  const tab2TitleRef = useRef<HTMLHeadingElement>(null);
  const tab2DescRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    // 显示欢迎信息和依赖检查
    addLog(t.appTitle);
    addLog('');
    
    checkDeps();
    
    EventsOn('conversion:progress', (data: ConversionProgress) => {
      if (data.error) {
        addLog(`[ERROR] ${data.error}`);
        setIsConverting(false);
      } else if (data.step === -1) {
        // 错误信号，重置转换状态
        setIsConverting(false);
      } else {
        addLog(`[Step ${data.step}] ${data.message}`);
        if (data.output) {
          addLog(data.output);
        }
        if (data.message.includes('completed successfully')) {
          setIsConverting(false);
          showAlertMessage(t.conversionSuccess, 'success');
        }
      }
    });
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  // Baffle animation for tab text when switching
  useEffect(() => {
    const waves = ' ﹊﹍﹎﹋﹌﹏';
    const bricks = '░░▒▓█';
    const lines = '├─┼┴┬┤';
    
    const refs = activeTab === 'mp4ToPss' 
      ? [tab1TitleRef.current, tab1DescRef.current]
      : [tab2TitleRef.current, tab2DescRef.current];
    
    refs.forEach((ref, index) => {
      if (ref) {
        // 保存原始文本
        const originalText = ref.textContent || '';
        
        const b = baffle(ref, {
          characters: lines + bricks + waves,
          speed: 75
        });
        
        setTimeout(() => {
          b.start();
          setTimeout(() => {
            b.reveal(600);
            // 确保动画结束后文本正确
            setTimeout(() => {
              if (ref.textContent !== originalText) {
                ref.textContent = originalText;
              }
            }, 650);
          }, 100);
        }, index * 200);
      }
    });
  }, [activeTab]);

  const checkDeps = async () => {
    addLog(t.checkingDeps);
    const deps = await CheckDependencies();
    
    addLog(`  FFMPEG:    ${deps.ffmpeg ? `✓ ${t.found}` : `✗ ${t.missing}`}`);
    addLog(`  PS2STR:    ${deps.ps2str ? `✓ ${t.found}` : `✗ ${t.missing}`}`);
    addLog(`  VGMSTREAM: ${deps.vgmstream ? `✓ ${t.found}` : `✗ ${t.missing}`}`);
    addLog('');
    
    const missing = Object.entries(deps)
      .filter(([_, exists]) => !exists)
      .map(([name, _]) => name);
    
    if (missing.length > 0) {
      addLog(`${t.warningMissingDeps} ${missing.join(', ')}`);
      addLog(t.placeDepsMsg);
      addLog('');
    } else {
      addLog(t.allDepsFound);
      addLog('');
    }
  };

  const addLog = (message: string) => {
    setLogs((prev: string[]) => [...prev, message]);
  };

  const showAlertMessage = (msg: string, type: 'success' | 'warning' | 'info' = 'info') => {
    setAlertMsg(msg);
    setAlertType(type);
    setShowAlert(true);
  };

  const closeAlert = () => {
    setShowAlert(false);
  };

  const handleSelectMp4Input = async () => {
    try {
      const file = await SelectFile('video');
      if (file) {
        setMp4Input(file);
        setPssOutput(file.replace(/\.[^/.]+$/, '.pss'));
      }
    } catch (err) {
      console.error('File selection cancelled');
    }
  };

  const handleSavePssOutput = async () => {
    try {
      const file = await SaveFile('output.pss', 'pss');
      if (file) {
        setPssOutput(file);
      }
    } catch (err) {
      console.error('Save cancelled');
    }
  };

  const handleConvertToPss = async () => {
    if (!mp4Input || !pssOutput) {
      showAlertMessage(t.selectInputOutput, 'warning');
      return;
    }
    
    if (width <= 0 || height <= 0 || bitrate <= 0) {
      showAlertMessage(t.invalidValues, 'warning');
      return;
    }
    
    setIsConverting(true);
    setLogs([]);
    addLog(t.startingMp4ToPss);
    
    try {
      await ConvertToPSS(mp4Input, pssOutput, width, height, bitrate, keepFilesPss);
    } catch (err: any) {
      addLog(`${t.conversionFailed}: ${err}`);
      setIsConverting(false);
    }
  };

  const handleSelectPssInput = async () => {
    try {
      const file = await SelectFile('pss');
      if (file) {
        setPssInput(file);
        setMp4Output(file.replace(/\.[^/.]+$/, '.mp4'));
      }
    } catch (err) {
      console.error('File selection cancelled');
    }
  };

  const handleSaveMp4Output = async () => {
    try {
      const file = await SaveFile('output.mp4', 'mp4');
      if (file) {
        setMp4Output(file);
      }
    } catch (err) {
      console.error('Save cancelled');
    }
  };

  const handleConvertToMp4 = async () => {
    if (!pssInput || !mp4Output) {
      showAlertMessage(t.selectInputOutput, 'warning');
      return;
    }
    
    setIsConverting(true);
    setLogs([]);
    addLog(t.startingPssToMp4);
    
    try {
      await ConvertToMP4(pssInput, mp4Output, keepFilesMp4);
    } catch (err: any) {
      addLog(`${t.conversionFailed}: ${err}`);
      setIsConverting(false);
    }
  };

  return (
    <div className="app crt-bg custom-bg">
      {showAlert && (
        <>
          <div className="overlay" onClick={closeAlert}></div>
          <div className="alert">
            <div className={`alert-content alert-${alertType}`}>
              <p>{alertMsg}</p>
            </div>
            <button onClick={closeAlert} className='crt'>OK</button>
          </div>
        </>
      )}

      <div className="main-content">
        <div className="tabs">
          <div 
            className={`tab ${activeTab === 'mp4ToPss' ? 'active' : ''}`}
            onClick={() => setActiveTab('mp4ToPss')}
          >
            <h2 className="animated-text-reveal" ref={tab1TitleRef}>{t.mp4ToPss}</h2>
            <p ref={tab1DescRef}>{t.mp4ToPssDesc}</p>
          </div>
          <div 
            className={`tab ${activeTab === 'pssToMp4' ? 'active' : ''}`}
            onClick={() => setActiveTab('pssToMp4')}
          >
            <h2 className="animated-text-reveal" ref={tab2TitleRef}>{t.pssToMp4}</h2>
            <p ref={tab2DescRef}>{t.pssToMp4Desc}</p>
          </div>
        </div>

        <div className="content-area">
          {activeTab === 'mp4ToPss' && (
            <div className="conversion-panel animated-border">
              <svg className="border-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline className="keyline keyline1" points="0,0 100,0 100,100 0,100 0,0" fill="none" stroke="#777" strokeWidth="0.5"/>
              </svg>
              
              <div className="input-group">
                <label>{t.sourceVideoFile}</label>
                <div className="file-input">
                  <input type="text" value={mp4Input} readOnly />
                  <button onClick={handleSelectMp4Input} disabled={isConverting}>{t.browse}</button>
                </div>
              </div>

              <div className="settings-row">
                <div className="setting-item">
                  <label>{t.resolution}</label>
                  <div className="resolution-inputs">
                    <input 
                      type="number" 
                      value={width} 
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWidth(Number(e.target.value))}
                      disabled={isConverting}
                    />
                    <span>×</span>
                    <input 
                      type="number" 
                      value={height} 
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHeight(Number(e.target.value))}
                      disabled={isConverting}
                    />
                  </div>
                </div>
                
                <div className="setting-item">
                  <label>{t.videoBitrate}</label>
                  <input 
                    type="number" 
                    value={bitrate} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBitrate(Number(e.target.value))}
                    disabled={isConverting}
                    className="bitrate-input"
                  />
                </div>

                <div className="setting-item checkbox-inline">
                  <label>
                    <input 
                      type="checkbox" 
                      checked={keepFilesPss}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKeepFilesPss(e.target.checked)}
                      disabled={isConverting}
                    />
                    {t.keepIntermediateFiles}
                  </label>
                </div>
              </div>

              <div className="input-group">
                <label>{t.outputPssFile}</label>
                <div className="file-input">
                  <input type="text" value={pssOutput} readOnly />
                  <button onClick={handleSavePssOutput} disabled={isConverting}>{t.saveAs}</button>
                </div>
              </div>

              <button 
                className={`convert-btn crt-static ${isConverting ? 'converting' : ''}`}
                onClick={handleConvertToPss}
                disabled={isConverting}
              >
                {isConverting ? t.converting : t.convertToPss}
              </button>
            </div>
          )}

          {activeTab === 'pssToMp4' && (
            <div className="conversion-panel animated-border">
              <svg className="border-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline className="keyline keyline1" points="0,0 100,0 100,100 0,100 0,0" fill="none" stroke="#777" strokeWidth="0.5"/>
              </svg>
              
              <div className="input-group">
                <label>{t.sourcePssFile}</label>
                <div className="file-input">
                  <input type="text" value={pssInput} readOnly />
                  <button onClick={handleSelectPssInput} disabled={isConverting}>{t.browse}</button>
                </div>
              </div>

              <div className="checkbox-group">
                <label>
                  <input 
                    type="checkbox" 
                    checked={keepFilesMp4}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKeepFilesMp4(e.target.checked)}
                    disabled={isConverting}
                  />
                  {t.keepIntermediateFilesMp4}
                </label>
              </div>

              <div className="input-group">
                <label>{t.outputMp4File}</label>
                <div className="file-input">
                  <input type="text" value={mp4Output} readOnly />
                  <button onClick={handleSaveMp4Output} disabled={isConverting}>{t.saveAs}</button>
                </div>
              </div>

              <button 
                className={`convert-btn crt-static ${isConverting ? 'converting' : ''}`}
                onClick={handleConvertToMp4}
                disabled={isConverting}
              >
                {isConverting ? t.converting : t.convertToMp4}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="log-section animated-border">
        <svg className="border-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline className="keyline keyline1" points="0,0 100,0 100,100 0,100 0,0" fill="none" stroke="#777" strokeWidth="0.5"/>
        </svg>
        <h3 className="animated-text-reveal crt">{t.conversionLog}</h3>
        <div className="log-container" ref={logRef}>
          {logs.length > 0 ? (
            logs.map((log, idx) => (
              <div 
                key={idx} 
                className="log-entry"
              >
                {log}
              </div>
            ))
          ) : (
            <div className="log-empty">{t.noLogsYet}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
