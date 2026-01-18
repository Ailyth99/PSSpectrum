import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import './custom.css';
import { SelectFile, SaveFile, CheckDependencies, ConvertToPSS, ConvertToMP4 } from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { translations, Language } from './i18n';
import baffle from 'baffle';

interface Progress {
  step: number;
  message: string;
  output: string;
  error?: string;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'mp4ToPss' | 'pssToMp4'>('mp4ToPss');
  
  const getLang = (): Language => {
    const lang = navigator.language.toLowerCase();
    return lang === 'zh-cn' || lang === 'zh' ? 'zh' : 'en';
  };
  
  const [language] = useState<Language>(getLang());
  const t = translations[language];
  
  const [mp4In, setMp4In] = useState('');
  const [pssOut, setPssOut] = useState('');
  const [width, setWidth] = useState(640);
  const [height, setHeight] = useState(448);
  const [bitrate, setBitrate] = useState(8000);
  const [keepPss, setKeepPss] = useState(false);
  
  const [pssIn, setPssIn] = useState('');
  const [mp4Out, setMp4Out] = useState('');
  const [keepMp4, setKeepMp4] = useState(false);
  
  const [converting, setConverting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [alert, setAlert] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'warning' | 'info'>('info');
  
  const logRef = useRef<HTMLDivElement>(null);
  const tab1TitleRef = useRef<HTMLHeadingElement>(null);
  const tab1DescRef = useRef<HTMLParagraphElement>(null);
  const tab2TitleRef = useRef<HTMLHeadingElement>(null);
  const tab2DescRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    addLog(t.appTitle);
    addLog('');
    checkDeps();
    
    EventsOn('conversion:progress', (data: Progress) => {
      if (data.error) {
        addLog(`[ERROR] ${data.error}`);
        setConverting(false);
      } else if (data.step === -1) {
        setConverting(false);
      } else {
        addLog(`[Step ${data.step}] ${data.message}`);
        if (data.output) {
          addLog(data.output);
        }
        if (data.message.includes('completed successfully')) {
          setConverting(false);
          showMsg(t.conversionSuccess, 'success');
        }
      }
    });
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    const waves = ' ﹊﹍﹎﹋﹌﹏';
    const bricks = '░░▒▓█';
    const lines = '├─┼┴┬┤';
    
    const refs = activeTab === 'mp4ToPss' 
      ? [tab1TitleRef.current, tab1DescRef.current]
      : [tab2TitleRef.current, tab2DescRef.current];
    
    refs.forEach((ref, index) => {
      if (ref) {
        const origTxt = ref.textContent || '';
        const b = baffle(ref, {
          characters: lines + bricks + waves,
          speed: 75
        });
        
        setTimeout(() => {
          b.start();
          setTimeout(() => {
            b.reveal(600);
            setTimeout(() => {
              if (ref.textContent !== origTxt) {
                ref.textContent = origTxt;
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

  const addLog = (msg: string) => {
    setLogs((prev: string[]) => [...prev, msg]);
  };

  const showMsg = (msg: string, type: 'success' | 'warning' | 'info' = 'info') => {
    setAlertMsg(msg);
    setAlertType(type);
    setAlert(true);
  };

  const closeAlert = () => {
    setAlert(false);
  };

  const selectMp4 = async () => {
    try {
      const file = await SelectFile('video');
      if (file) {
        setMp4In(file);
        setPssOut(file.replace(/\.[^/.]+$/, '.pss'));
      }
    } catch (err) {
      console.error('File selection cancelled');
    }
  };

  const savePss = async () => {
    try {
      const file = await SaveFile('output.pss', 'pss');
      if (file) {
        setPssOut(file);
      }
    } catch (err) {
      console.error('Save cancelled');
    }
  };

  const convertPss = async () => {
    if (!mp4In || !pssOut) {
      showMsg(t.selectInputOutput, 'warning');
      return;
    }
    
    if (width <= 0 || height <= 0 || bitrate <= 0) {
      showMsg(t.invalidValues, 'warning');
      return;
    }
    
    setConverting(true);
    setLogs([]);
    addLog(t.startingMp4ToPss);
    
    try {
      await ConvertToPSS(mp4In, pssOut, width, height, bitrate, keepPss);
    } catch (err: any) {
      addLog(`${t.conversionFailed}: ${err}`);
      setConverting(false);
    }
  };

  const selectPss = async () => {
    try {
      const file = await SelectFile('pss');
      if (file) {
        setPssIn(file);
        setMp4Out(file.replace(/\.[^/.]+$/, '.mp4'));
      }
    } catch (err) {
      console.error('File selection cancelled');
    }
  };

  const saveMp4 = async () => {
    try {
      const file = await SaveFile('output.mp4', 'mp4');
      if (file) {
        setMp4Out(file);
      }
    } catch (err) {
      console.error('Save cancelled');
    }
  };

  const convertMp4 = async () => {
    if (!pssIn || !mp4Out) {
      showMsg(t.selectInputOutput, 'warning');
      return;
    }
    
    setConverting(true);
    setLogs([]);
    addLog(t.startingPssToMp4);
    
    try {
      await ConvertToMP4(pssIn, mp4Out, keepMp4);
    } catch (err: any) {
      addLog(`${t.conversionFailed}: ${err}`);
      setConverting(false);
    }
  };

  return (
    <div className="app crt-bg custom-bg">
      {alert && (
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
                  <input type="text" value={mp4In} readOnly />
                  <button onClick={selectMp4} disabled={converting}>{t.browse}</button>
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
                      disabled={converting}
                    />
                    <span>×</span>
                    <input 
                      type="number" 
                      value={height} 
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHeight(Number(e.target.value))}
                      disabled={converting}
                    />
                  </div>
                </div>
                
                <div className="setting-item">
                  <label>{t.videoBitrate}</label>
                  <input 
                    type="number" 
                    value={bitrate} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBitrate(Number(e.target.value))}
                    disabled={converting}
                    className="bitrate-input"
                  />
                </div>

                <div className="setting-item checkbox-inline">
                  <label>
                    <input 
                      type="checkbox" 
                      checked={keepPss}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKeepPss(e.target.checked)}
                      disabled={converting}
                    />
                    {t.keepIntermediateFiles}
                  </label>
                </div>
              </div>

              <div className="input-group">
                <label>{t.outputPssFile}</label>
                <div className="file-input">
                  <input type="text" value={pssOut} readOnly />
                  <button onClick={savePss} disabled={converting}>{t.saveAs}</button>
                </div>
              </div>

              <button 
                className={`convert-btn crt-static ${converting ? 'converting' : ''}`}
                onClick={convertPss}
                disabled={converting}
              >
                {converting ? t.converting : t.convertToPss}
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
                  <input type="text" value={pssIn} readOnly />
                  <button onClick={selectPss} disabled={converting}>{t.browse}</button>
                </div>
              </div>

              <div className="checkbox-group">
                <label>
                  <input 
                    type="checkbox" 
                    checked={keepMp4}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKeepMp4(e.target.checked)}
                    disabled={converting}
                  />
                  {t.keepIntermediateFilesMp4}
                </label>
              </div>

              <div className="input-group">
                <label>{t.outputMp4File}</label>
                <div className="file-input">
                  <input type="text" value={mp4Out} readOnly />
                  <button onClick={saveMp4} disabled={converting}>{t.saveAs}</button>
                </div>
              </div>

              <button 
                className={`convert-btn crt-static ${converting ? 'converting' : ''}`}
                onClick={convertMp4}
                disabled={converting}
              >
                {converting ? t.converting : t.convertToMp4}
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
              <div key={idx} className="log-entry">
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
