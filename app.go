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

type ConversionProgress struct {
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

// SelectFile opens a file dialog to select input file
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

// SaveFile opens a save dialog
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

// CheckDependencies checks if required executables exist
func (a *App) CheckDependencies() map[string]bool {
	exePath, _ := os.Executable()
	baseDir := filepath.Dir(exePath)
	
	// 在开发模式下，使用当前工作目录
	if strings.Contains(exePath, "go-build") || strings.Contains(exePath, "Temp") {
		baseDir, _ = os.Getwd()
	}
	
	result := make(map[string]bool)
	result["ffmpeg"] = fileExists(filepath.Join(baseDir, "ffmpeg.exe"))
	result["ps2str"] = fileExists(filepath.Join(baseDir, "bin", "ps2str.exe"))
	result["vgmstream"] = fileExists(filepath.Join(baseDir, "bin", "vgmstream-cli.exe"))
	
	return result
}

// ConvertToPSS converts video to PSS format
func (a *App) ConvertToPSS(inputFile, outputFile string, width, height, bitrate int, keepFiles bool) {
	go func() {
		exePath, _ := os.Executable()
		baseDir := filepath.Dir(exePath)
		
		// 在开发模式下，使用当前工作目录
		if strings.Contains(exePath, "go-build") || strings.Contains(exePath, "Temp") {
			baseDir, _ = os.Getwd()
		}
		
		ffmpegPath := filepath.Join(baseDir, "ffmpeg.exe")
		ps2strPath := filepath.Join(baseDir, "bin", "ps2str.exe")
		
		basePath := strings.TrimSuffix(outputFile, filepath.Ext(outputFile))
		outputDir := filepath.Dir(outputFile)
		m2vFile := basePath + ".m2v"
		wavFile := basePath + ".wav"
		adsFile := basePath + ".ads"
		muxFile := basePath + ".mux"
		
		// Step 1: FFMPEG conversion
		a.emitProgress(1, "Generating M2V and WAV files with FFMPEG...", "")
		
		bitrateStr := fmt.Sprintf("%dk", bitrate)
		resolution := fmt.Sprintf("%dx%d", width, height)
		
		cmd := exec.Command(ffmpegPath,
			"-i", inputFile,
			"-c:v", "mpeg2video",
			"-profile:v", "4",
			"-level:v", "8",
			"-b:v", bitrateStr,
			"-bufsize", "1835k",
			"-maxrate", bitrateStr,
			"-minrate", bitrateStr,
			"-color_range", "tv",
			"-colorspace", "smpte170m",
			"-color_trc", "smpte170m",
			"-color_primaries", "smpte170m",
			"-field_order", "progressive",
			"-s", resolution,
			"-an", "-y", m2vFile,
			"-vn", "-acodec", "pcm_s16le",
			"-ar", "48000", "-ac", "2",
			"-y", wavFile,
		)
		
		// Hide console window on Windows
		cmd.SysProcAttr = &syscall.SysProcAttr{
			HideWindow:    true,
			CreationFlags: 0x08000000, // CREATE_NO_WINDOW
		}
		
		output, err := cmd.CombinedOutput()
		if err != nil {
			a.emitProgress(1, "", fmt.Sprintf("FFMPEG failed: %v\n%s", err, string(output)))
			a.emitProgress(-1, "Conversion failed", "")
			return
		}
		a.emitProgress(1, "FFMPEG conversion completed", string(output))
		
		// Step 2: Inject metadata
		a.emitProgress(2, "Injecting metadata into M2V file...", "")
		if err := injectMetadata(m2vFile); err != nil {
			a.emitProgress(2, "", fmt.Sprintf("Metadata injection failed: %v", err))
			a.emitProgress(-1, "Conversion failed", "")
			return
		}
		a.emitProgress(2, "Metadata injected successfully", "")
		
		// Step 3: Append sequence end code
		a.emitProgress(3, "Appending sequence end code...", "")
		if err := appendSequenceEndCode(m2vFile); err != nil {
			a.emitProgress(3, "", fmt.Sprintf("Failed to append end code: %v", err))
			a.emitProgress(-1, "Conversion failed", "")
			return
		}
		a.emitProgress(3, "Sequence end code appended", "")
		
		// Step 4: Generate ADS audio
		a.emitProgress(4, "Generating ADS audio with PS2STR...", "")
		cmd = exec.Command(ps2strPath, "e", "-o", "-v", "-d", outputDir, wavFile)
		cmd.SysProcAttr = &syscall.SysProcAttr{
			HideWindow:    true,
			CreationFlags: 0x08000000,
		}
		output, err = cmd.CombinedOutput()
		if err != nil {
			a.emitProgress(4, "", fmt.Sprintf("PS2STR audio encoding failed: %v\n%s", err, string(output)))
			a.emitProgress(-1, "Conversion failed", "")
			return
		}
		a.emitProgress(4, "ADS audio generated", string(output))
		
		// Step 5: Create mux file
		a.emitProgress(5, "Creating project file...", "")
		muxContent := fmt.Sprintf(`pss

	stream video:0
		input "%s"
	end

	stream pcm:0
		input "%s"
	end
end
`, filepath.ToSlash(m2vFile), filepath.ToSlash(adsFile))
		
		if err := os.WriteFile(muxFile, []byte(muxContent), 0644); err != nil {
			a.emitProgress(5, "", fmt.Sprintf("Failed to create mux file: %v", err))
			a.emitProgress(-1, "Conversion failed", "")
			return
		}
		a.emitProgress(5, "Project file created", "")
		
		// Step 6: Multiplex PSS
		a.emitProgress(6, "Multiplexing PSS file with PS2STR...", "")
		cmd = exec.Command(ps2strPath, "m", "-o", "-v", "-d", outputDir, muxFile)
		cmd.SysProcAttr = &syscall.SysProcAttr{
			HideWindow:    true,
			CreationFlags: 0x08000000,
		}
		output, err = cmd.CombinedOutput()
		if err != nil {
			a.emitProgress(6, "", fmt.Sprintf("PS2STR multiplexing failed: %v\n%s", err, string(output)))
			a.emitProgress(-1, "Conversion failed", "")
			return
		}
		a.emitProgress(6, "PSS file created successfully!", string(output))
		
		// Cleanup
		if !keepFiles {
			os.Remove(m2vFile)
			os.Remove(wavFile)
			os.Remove(adsFile)
			os.Remove(muxFile)
		}
		
		a.emitProgress(7, "Conversion completed successfully!", "")
	}()
}

// ConvertToMP4 converts PSS to MP4 format
func (a *App) ConvertToMP4(inputFile, outputFile string, keepFiles bool) {
	go func() {
		exePath, _ := os.Executable()
		baseDir := filepath.Dir(exePath)
		
		// 在开发模式下，使用当前工作目录
		if strings.Contains(exePath, "go-build") || strings.Contains(exePath, "Temp") {
			baseDir, _ = os.Getwd()
		}
		
		ffmpegPath := filepath.Join(baseDir, "ffmpeg.exe")
		ps2strPath := filepath.Join(baseDir, "bin", "ps2str.exe")
		vgmstreamPath := filepath.Join(baseDir, "bin", "vgmstream-cli.exe")
		
		pssDir := filepath.Dir(inputFile)
		baseName := strings.TrimSuffix(filepath.Base(inputFile), filepath.Ext(inputFile))
		m2vFile := filepath.Join(pssDir, baseName+"_video_0.m2v")
		adsFile := filepath.Join(pssDir, baseName+"_pcm_0.ads")
		wavFile := filepath.Join(pssDir, baseName+"_temp.wav")
		
		// Step 1: Demultiplex PSS
		a.emitProgress(1, "Demultiplexing PSS file with PS2STR...", "")
		cmd := exec.Command(ps2strPath, "d", "-o", "-v", "-d", pssDir, inputFile)
		cmd.SysProcAttr = &syscall.SysProcAttr{
			HideWindow:    true,
			CreationFlags: 0x08000000,
		}
		output, err := cmd.CombinedOutput()
		if err != nil {
			a.emitProgress(1, "", fmt.Sprintf("PS2STR demultiplexing failed: %v\n%s", err, string(output)))
			a.emitProgress(-1, "Conversion failed", "")
			return
		}
		a.emitProgress(1, "PSS demultiplexed successfully", string(output))
		
		// Step 2: Convert audio
		a.emitProgress(2, "Converting audio with vgmstream-cli...", "")
		cmd = exec.Command(vgmstreamPath, "-o", wavFile, adsFile)
		cmd.SysProcAttr = &syscall.SysProcAttr{
			HideWindow:    true,
			CreationFlags: 0x08000000,
		}
		output, err = cmd.CombinedOutput()
		if err != nil {
			a.emitProgress(2, "", fmt.Sprintf("Audio conversion failed: %v\n%s", err, string(output)))
			a.emitProgress(-1, "Conversion failed", "")
			return
		}
		a.emitProgress(2, "Audio converted successfully", string(output))
		
		// Step 3: Multiplex MP4
		a.emitProgress(3, "Multiplexing MP4 file with FFMPEG...", "")
		cmd = exec.Command(ffmpegPath,
			"-i", m2vFile,
			"-i", wavFile,
			"-c:v", "copy",
			"-c:a", "aac",
			"-b:a", "192k",
			"-y", outputFile,
		)
		cmd.SysProcAttr = &syscall.SysProcAttr{
			HideWindow:    true,
			CreationFlags: 0x08000000,
		}
		output, err = cmd.CombinedOutput()
		if err != nil {
			a.emitProgress(3, "", fmt.Sprintf("FFMPEG multiplexing failed: %v\n%s", err, string(output)))
			a.emitProgress(-1, "Conversion failed", "")
			return
		}
		a.emitProgress(3, "MP4 file created successfully!", string(output))
		
		// Cleanup
		if !keepFiles {
			os.Remove(m2vFile)
			os.Remove(adsFile)
			os.Remove(wavFile)
		}
		
		a.emitProgress(4, "Conversion completed successfully!", "")
	}()
}

func (a *App) emitProgress(step int, message, output string) {
	runtime.EventsEmit(a.ctx, "conversion:progress", ConversionProgress{
		Step:    step,
		Message: message,
		Output:  output,
	})
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func injectMetadata(m2vPath string) error {
	content, err := os.ReadFile(m2vPath)
	if err != nil {
		return err
	}
	
	gopStartCode := []byte{0x00, 0x00, 0x01, 0xb8}
	userDataStartCode := []byte{0x00, 0x00, 0x01, 0xb2}
	metadataComment := "==== Created with PSSpectrum. Powered by FFMPEG, PS2STR, and VGMSTREAM.|||https://github.com/Ailyth99/PSSpectrum ===="
	
	insertionPoint := indexOf(content, gopStartCode)
	if insertionPoint == -1 {
		return fmt.Errorf("GOP start code not found")
	}
	
	payload := append(userDataStartCode, []byte(metadataComment)...)
	newContent := append(content[:insertionPoint], append(payload, content[insertionPoint:]...)...)
	
	return os.WriteFile(m2vPath, newContent, 0644)
}

func appendSequenceEndCode(m2vPath string) error {
	sequenceEndCode := []byte{0x00, 0x00, 0x01, 0xb7}
	
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
		_, err = f.Write(sequenceEndCode)
		return err
	}
	
	content, err := os.ReadFile(m2vPath)
	if err != nil {
		return err
	}
	
	lastFour := content[len(content)-4:]
	if string(lastFour) == string(sequenceEndCode) {
		return nil
	}
	
	f, err := os.OpenFile(m2vPath, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	
	_, err = f.Write(sequenceEndCode)
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
