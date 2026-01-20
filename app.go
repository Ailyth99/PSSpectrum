package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx context.Context
}

type Progress struct {
	Step    int    `json:"step"`
	Message string `json:"message"`
	Output  string `json:"output"`
	Error   string `json:"error"`
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) SelectFile(fileType string) (string, error) {
	var filters []runtime.FileFilter
	
	if fileType == "video" {
		filters = []runtime.FileFilter{
			{DisplayName: "Video Files", Pattern: "*.mp4;*.mkv;*.avi;*.mov"},
			{DisplayName: "All Files", Pattern: "*.*"},
		}
	} else if fileType == "pss" {
		filters = []runtime.FileFilter{
			{DisplayName: "PSS Files", Pattern: "*.pss"},
			{DisplayName: "All Files", Pattern: "*.*"},
		}
	}

	file, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title:   "Select File",
		Filters: filters,
	})
	
	return file, err
}

func (a *App) SaveFile(defaultName string, fileType string) (string, error) {
	var filters []runtime.FileFilter
	
	if fileType == "pss" {
		filters = []runtime.FileFilter{
			{DisplayName: "PSS Files", Pattern: "*.pss"},
		}
	} else if fileType == "mp4" {
		filters = []runtime.FileFilter{
			{DisplayName: "MP4 Files", Pattern: "*.mp4"},
		}
	}

	file, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save File",
		DefaultFilename: defaultName,
		Filters:         filters,
	})
	
	return file, err
}

func (a *App) CheckDependencies() map[string]bool {
	exePath, _ := os.Executable()
	baseDir := filepath.Dir(exePath)
	
	if strings.Contains(exePath, "go-build") || strings.Contains(exePath, "Temp") {
		baseDir, _ = os.Getwd()
	}
	
	result := make(map[string]bool)
	result["ffmpeg"] = fileExists(filepath.Join(baseDir, "ffmpeg.exe"))
	result["ps2str"] = fileExists(filepath.Join(baseDir, "bin", "ps2str.exe"))
	result["vgmstream"] = fileExists(filepath.Join(baseDir, "bin", "vgmstream-cli.exe"))
	
	return result
}

func (a *App) ConvertToPSS(inFile, outFile string, w, h, br int, keep bool) {
	go func() {
		exePath, _ := os.Executable()
		baseDir := filepath.Dir(exePath)
		
		if strings.Contains(exePath, "go-build") || strings.Contains(exePath, "Temp") {
			baseDir, _ = os.Getwd()
		}
		
		ffmpeg := filepath.Join(baseDir, "ffmpeg.exe")
		ps2str := filepath.Join(baseDir, "bin", "ps2str.exe")
		
		base := strings.TrimSuffix(outFile, filepath.Ext(outFile))
		outDir := filepath.Dir(outFile)
		m2v := base + ".m2v"
		wav := base + ".wav"
		ads := base + ".ads"
		mux := base + ".mux"
		
		a.emit(1, "Generating M2V and WAV files with FFMPEG...", "")
		
		brStr := fmt.Sprintf("%dk", br)
		res := fmt.Sprintf("%dx%d", w, h)
		
		cmd := exec.Command(ffmpeg,
			"-i", inFile,
			"-c:v", "mpeg2video",
			"-profile:v", "4",
			"-level:v", "8",
			"-b:v", brStr,
			"-bufsize", "1835k",
			"-maxrate", brStr,
			"-minrate", brStr,
			"-color_range", "tv",
			"-colorspace", "smpte170m",
			"-color_trc", "smpte170m",
			"-color_primaries", "smpte170m",
			"-field_order", "progressive",
			"-s", res,
			"-an", "-y", m2v,
			"-vn", "-acodec", "pcm_s16le",
			"-ar", "48000", "-ac", "2",
			"-y", wav,
		)
		
		cmd.SysProcAttr = &syscall.SysProcAttr{
			HideWindow:    true,
			CreationFlags: 0x08000000,
		}
		
		out, err := cmd.CombinedOutput()
		if err != nil {
			a.emit(1, "", fmt.Sprintf("FFMPEG failed: %v\n%s", err, string(out)))
			a.emit(-1, "Conversion failed", "")
			return
		}
		a.emit(1, "FFMPEG conversion completed", string(out))
		
		if err := injectMeta(m2v); err != nil {
			a.emit(2, "", fmt.Sprintf("Metadata injection failed: %v", err))
			a.emit(-1, "Conversion failed", "")
			return
		}
		
		if err := appendEnd(m2v); err != nil {
			a.emit(2, "", fmt.Sprintf("Failed to append end code: %v", err))
			a.emit(-1, "Conversion failed", "")
			return
		}
		
		a.emit(2, "Generating ADS audio with PS2STR...", "")
		cmd = exec.Command(ps2str, "e", "-o", "-v", "-d", outDir, wav)
		cmd.SysProcAttr = &syscall.SysProcAttr{
			HideWindow:    true,
			CreationFlags: 0x08000000,
		}
		out, err = cmd.CombinedOutput()
		if err != nil {
			a.emit(2, "", fmt.Sprintf("PS2STR audio encoding failed: %v\n%s", err, string(out)))
			a.emit(-1, "Conversion failed", "")
			return
		}
		a.emit(2, "ADS audio generated", string(out))
		
		a.emit(3, "Creating project file...", "")
		muxContent := fmt.Sprintf(`pss

	stream video:0
		input "%s"
	end

	stream pcm:0
		input "%s"
	end
end
`, filepath.ToSlash(m2v), filepath.ToSlash(ads))
		
		if err := os.WriteFile(mux, []byte(muxContent), 0644); err != nil {
			a.emit(3, "", fmt.Sprintf("Failed to create mux file: %v", err))
			a.emit(-1, "Conversion failed", "")
			return
		}
		a.emit(3, "Project file created", "")
		
		a.emit(4, "Multiplexing PSS file with PS2STR...", "")
		cmd = exec.Command(ps2str, "m", "-o", "-v", "-d", outDir, mux)
		cmd.SysProcAttr = &syscall.SysProcAttr{
			HideWindow:    true,
			CreationFlags: 0x08000000,
		}
		out, err = cmd.CombinedOutput()
		if err != nil {
			a.emit(4, "", fmt.Sprintf("PS2STR multiplexing failed: %v\n%s", err, string(out)))
			a.emit(-1, "Conversion failed", "")
			return
		}
		a.emit(4, "PSS file created successfully!", string(out))
		
		if !keep {
			os.Remove(m2v)
			os.Remove(wav)
			os.Remove(ads)
			os.Remove(mux)
		}
		
		a.emit(5, "Conversion completed successfully!", "")
	}()
}

func (a *App) ConvertToMP4(inFile, outFile string, keep bool) {
	go func() {
		exePath, _ := os.Executable()
		baseDir := filepath.Dir(exePath)
		
		if strings.Contains(exePath, "go-build") || strings.Contains(exePath, "Temp") {
			baseDir, _ = os.Getwd()
		}
		
		ffmpeg := filepath.Join(baseDir, "ffmpeg.exe")
		ps2str := filepath.Join(baseDir, "bin", "ps2str.exe")
		vgm := filepath.Join(baseDir, "bin", "vgmstream-cli.exe")
		
		pssDir := filepath.Dir(inFile)
		base := strings.TrimSuffix(filepath.Base(inFile), filepath.Ext(inFile))
		m2v := filepath.Join(pssDir, base+"_video_0.m2v")
		ads := filepath.Join(pssDir, base+"_pcm_0.ads")
		wav := filepath.Join(pssDir, base+"_temp.wav")
		
		a.emit(1, "Demultiplexing PSS file with PS2STR...", "")
		cmd := exec.Command(ps2str, "d", "-o", "-v", "-d", pssDir, inFile)
		cmd.SysProcAttr = &syscall.SysProcAttr{
			HideWindow:    true,
			CreationFlags: 0x08000000,
		}
		out, err := cmd.CombinedOutput()
		if err != nil {
			a.emit(1, "", fmt.Sprintf("PS2STR demultiplexing failed: %v\n%s", err, string(out)))
			a.emit(-1, "Conversion failed", "")
			return
		}
		a.emit(1, "PSS demultiplexed successfully", string(out))
		
		a.emit(2, "Converting audio with vgmstream-cli...", "")
		cmd = exec.Command(vgm, "-o", wav, ads)
		cmd.SysProcAttr = &syscall.SysProcAttr{
			HideWindow:    true,
			CreationFlags: 0x08000000,
		}
		out, err = cmd.CombinedOutput()
		if err != nil {
			a.emit(2, "", fmt.Sprintf("Audio conversion failed: %v\n%s", err, string(out)))
			a.emit(-1, "Conversion failed", "")
			return
		}
		a.emit(2, "Audio converted successfully", string(out))
		
		a.emit(3, "Multiplexing MP4 file with FFMPEG...", "")
		cmd = exec.Command(ffmpeg,
			"-i", m2v,
			"-i", wav,
			"-c:v", "copy",
			"-c:a", "aac",
			"-b:a", "192k",
			"-y", outFile,
		)
		cmd.SysProcAttr = &syscall.SysProcAttr{
			HideWindow:    true,
			CreationFlags: 0x08000000,
		}
		out, err = cmd.CombinedOutput()
		if err != nil {
			a.emit(3, "", fmt.Sprintf("FFMPEG multiplexing failed: %v\n%s", err, string(out)))
			a.emit(-1, "Conversion failed", "")
			return
		}
		a.emit(3, "MP4 file created successfully!", string(out))
		
		if !keep {
			os.Remove(m2v)
			os.Remove(ads)
			os.Remove(wav)
		}
		
		a.emit(4, "Conversion completed successfully!", "")
	}()
}

func (a *App) emit(step int, msg, out string) {
	runtime.EventsEmit(a.ctx, "conversion:progress", Progress{
		Step:    step,
		Message: msg,
		Output:  out,
	})
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func injectMeta(m2vPath string) error {
	content, err := os.ReadFile(m2vPath)
	if err != nil {
		return err
	}
	
	gopStart := []byte{0x00, 0x00, 0x01, 0xb8}
	userStart := []byte{0x00, 0x00, 0x01, 0xb2}
	meta := "==== Created with PSSpectrum. Powered by FFMPEG, PS2STR, and VGMSTREAM.|||https://github.com/Ailyth99/PSSpectrum ===="
	
	pos := indexOf(content, gopStart)
	if pos == -1 {
		return fmt.Errorf("GOP start code not found")
	}
	
	payload := append(userStart, []byte(meta)...)
	newContent := append(content[:pos], append(payload, content[pos:]...)...)
	
	return os.WriteFile(m2vPath, newContent, 0644)
}

func appendEnd(m2vPath string) error {
	endCode := []byte{0x00, 0x00, 0x01, 0xb7}
	
	info, err := os.Stat(m2vPath)
	if err != nil {
		return err
	}
	
	if info.Size() < 4 {
		f, err := os.OpenFile(m2vPath, os.O_APPEND|os.O_WRONLY, 0644)
		if err != nil {
			return err
		}
		defer f.Close()
		_, err = f.Write(endCode)
		return err
	}
	
	content, err := os.ReadFile(m2vPath)
	if err != nil {
		return err
	}
	
	last := content[len(content)-4:]
	if string(last) == string(endCode) {
		return nil
	}
	
	f, err := os.OpenFile(m2vPath, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	
	_, err = f.Write(endCode)
	return err
}

func indexOf(data []byte, pattern []byte) int {
	for i := 0; i <= len(data)-len(pattern); i++ {
		match := true
		for j := 0; j < len(pattern); j++ {
			if data[i+j] != pattern[j] {
				match = false
				break
			}
		}
		if match {
			return i
		}
	}
	return -1
}
