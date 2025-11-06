
import wx,os,sys,subprocess,threading,shutil

def get_base_path():
    try:
        if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
            return os.path.dirname(sys.executable)
        else:
            return os.path.dirname(os.path.abspath(__file__))
    except Exception:
        return os.path.abspath(".")

BASE_PATH = get_base_path()
FFMPEG_EXE = os.path.join(BASE_PATH, 'ffmpeg.exe')
PS2STR_EXE = os.path.join(BASE_PATH, 'bin', 'ps2str.exe')
VGMSTREAM_CLI_EXE = os.path.join(BASE_PATH, 'bin', 'vgmstream-cli.exe')
DEFAULT_WIDTH = 640
DEFAULT_HEIGHT = 448
DEFAULT_BITRATE = '8000'

SEQUENCE_END_CODE = b'\x00\x00\x01\xb7'
USER_DATA_START_CODE = b'\x00\x00\x01\xb2'
GOP_START_CODE = b'\x00\x00\x01\xb8'
METADATA_COMMENT = "==== Created with PSSpectrum. Powered by FFMPEG, PS2STR, and VGMSTREAM.|||https://github.com/Ailyth99/PSSpectrum ===="

def inject_metadata_to_m2v(m2v_path):

    try:
        with open(m2v_path, 'rb') as f:
            content = f.read()
    except FileNotFoundError:
        return False, f"M2V file '{os.path.basename(m2v_path)}' not found for metadata injection."
        
    insertion_point = content.find(GOP_START_CODE)
    if insertion_point == -1:
        return False, "Could not find GOP start code (000001B8) in M2V file."
    
    encoded_comment = METADATA_COMMENT.encode('ascii')
    payload = USER_DATA_START_CODE + encoded_comment
    new_content = content[:insertion_point] + payload + content[insertion_point:]
    
    try:
        with open(m2v_path, 'wb') as f:
            f.write(new_content)
    except IOError as e:
        return False, f"Failed to write to M2V file during metadata injection: {e}"
        
    return True, f"Successfully injected metadata comment ({len(payload)} bytes)."

def append_sequence_end_code_if_missing(m2v_path):

    try:
        file_size = os.path.getsize(m2v_path)
        
        if file_size < 4:
            with open(m2v_path, 'ab') as f:
                f.write(SEQUENCE_END_CODE)
            return True, f"File was too small. Force-appended sequence end code ({SEQUENCE_END_CODE.hex().upper()})."

        with open(m2v_path, 'rb') as f:
            f.seek(-4, os.SEEK_END)
            last_four_bytes = f.read(4)

        if last_four_bytes == SEQUENCE_END_CODE:
            return True, "Sequence end code already exists. No action needed."
        else:
            with open(m2v_path, 'ab') as f:
                f.write(SEQUENCE_END_CODE)
            return True, f"Successfully appended sequence end code ({SEQUENCE_END_CODE.hex().upper()}) to M2V file."

    except Exception as e:
        return False, f"An error occurred while checking or appending sequence end code: {e}"

#Main Window
class PSSConverterFrame(wx.Frame):
    def __init__(self, *args, **kw):
        super(PSSConverterFrame, self).__init__(*args, **kw)
        self.SetTitle("PSSpectrum - PS2 PSS <-> MP4 Converter (v1.0)")
        self.SetSize((700, 680))
        self.panel = wx.Panel(self)
        self.vbox = wx.BoxSizer(wx.VERTICAL)
        self._init_ui()
        self.panel.SetSizer(self.vbox)
        self.Centre()
        self.Show()
        self.check_dependencies()

    def _init_ui(self):
        notebook = wx.Notebook(self.panel)
        self.mp4_to_pss_panel = self._create_mp4_to_pss_tab(notebook)
        self.pss_to_mp4_panel = self._create_pss_to_mp4_tab(notebook)
        notebook.AddPage(self.mp4_to_pss_panel, "MP4 -> PSS")
        notebook.AddPage(self.pss_to_mp4_panel, "PSS -> MP4")
        
        log_box = wx.StaticBox(self.panel, label="Log Output")
        log_sizer = wx.StaticBoxSizer(log_box, wx.VERTICAL)
        self.log_text = wx.TextCtrl(self.panel, style=wx.TE_MULTILINE | wx.TE_READONLY | wx.TE_RICH)
        log_sizer.Add(self.log_text, proportion=1, flag=wx.EXPAND)

        self.vbox.Add(notebook, 1, wx.EXPAND | wx.ALL, 10)
        self.vbox.Add(log_sizer, 1, wx.EXPAND | wx.LEFT | wx.RIGHT | wx.BOTTOM, 10)
        
    def _create_mp4_to_pss_tab(self, parent):
        panel = wx.Panel(parent)
        vbox = wx.BoxSizer(wx.VERTICAL)
        
        input_box = wx.StaticBox(panel, label="1. Select Source Video File (MP4, MKV, etc.)")
        input_sizer = wx.StaticBoxSizer(input_box, wx.VERTICAL)
        hbox1 = wx.BoxSizer(wx.HORIZONTAL)
        self.mp4_input_text = wx.TextCtrl(panel, style=wx.TE_READONLY)
        browse_input_btn = wx.Button(panel, label="Browse...")
        hbox1.Add(self.mp4_input_text, 1, wx.EXPAND | wx.ALL, 5)
        hbox1.Add(browse_input_btn, 0, wx.ALL, 5)
        input_sizer.Add(hbox1, 1, wx.EXPAND)
        vbox.Add(input_sizer, 0, wx.EXPAND | wx.ALL, 5)
        browse_input_btn.Bind(wx.EVT_BUTTON, self.on_browse_mp4_input)

        settings_box = wx.StaticBox(panel, label="2. Encoding Settings")
        settings_sizer = wx.StaticBoxSizer(settings_box, wx.VERTICAL)
        hbox_res = wx.BoxSizer(wx.HORIZONTAL)
        self.width_text = wx.TextCtrl(panel, value=str(DEFAULT_WIDTH), size=(50,-1))
        self.height_text = wx.TextCtrl(panel, value=str(DEFAULT_HEIGHT), size=(50,-1))
        hbox_res.Add(wx.StaticText(panel, label="Resolution:"), 0, wx.ALIGN_CENTER_VERTICAL|wx.RIGHT, 5)
        hbox_res.Add(self.width_text, 1, wx.RIGHT, 5)
        hbox_res.Add(wx.StaticText(panel, label="x"), 0, wx.ALIGN_CENTER_VERTICAL|wx.RIGHT, 5)
        hbox_res.Add(self.height_text, 1, wx.RIGHT, 5)
        hbox_br = wx.BoxSizer(wx.HORIZONTAL)
        self.bitrate_text = wx.TextCtrl(panel, value=DEFAULT_BITRATE, size=(60,-1))
        hbox_br.Add(wx.StaticText(panel, label="Video Bitrate:"), 0, wx.ALIGN_CENTER_VERTICAL|wx.RIGHT, 5)
        hbox_br.Add(self.bitrate_text, 0, wx.RIGHT, 5)
        hbox_br.Add(wx.StaticText(panel, label="kbps"), 0, wx.ALIGN_CENTER_VERTICAL)
        top_sizer = wx.BoxSizer(wx.HORIZONTAL)
        top_sizer.Add(hbox_res, 1, wx.EXPAND | wx.RIGHT, 20)
        top_sizer.Add(hbox_br, 1, wx.EXPAND)
        settings_sizer.Add(top_sizer, 0, wx.EXPAND | wx.ALL, 5)
        vbox.Add(settings_sizer, 0, wx.EXPAND | wx.ALL, 5)
        
        optional_box = wx.StaticBox(panel, label="3. Options")
        optional_sizer = wx.StaticBoxSizer(optional_box, wx.HORIZONTAL)
        self.keep_files_pss_checkbox = wx.CheckBox(panel, label="Keep Intermediate Files")
        optional_sizer.Add(self.keep_files_pss_checkbox, 0, wx.ALIGN_CENTER_VERTICAL | wx.ALL, 5)
        vbox.Add(optional_sizer, 0, wx.EXPAND | wx.ALL, 5)
        
        output_box = wx.StaticBox(panel, label="4. Specify Output PSS File")
        output_sizer = wx.StaticBoxSizer(output_box, wx.VERTICAL)
        hbox_out = wx.BoxSizer(wx.HORIZONTAL)
        self.pss_output_text = wx.TextCtrl(panel, style=wx.TE_READONLY)
        save_as_pss_btn = wx.Button(panel, label="Save As...")
        hbox_out.Add(self.pss_output_text, 1, wx.EXPAND | wx.ALL, 5)
        hbox_out.Add(save_as_pss_btn, 0, wx.ALL, 5)
        output_sizer.Add(hbox_out, 1, wx.EXPAND)
        vbox.Add(output_sizer, 0, wx.EXPAND | wx.ALL, 5)
        save_as_pss_btn.Bind(wx.EVT_BUTTON, self.on_save_as_pss)

        self.convert_to_pss_btn = wx.Button(panel, label="Convert to PSS")
        vbox.Add(self.convert_to_pss_btn, 0, wx.EXPAND | wx.ALL, 5)
        self.convert_to_pss_btn.Bind(wx.EVT_BUTTON, self.on_convert_to_pss)
        
        panel.SetSizer(vbox)
        return panel

    def _create_pss_to_mp4_tab(self, parent):
        panel = wx.Panel(parent)
        vbox = wx.BoxSizer(wx.VERTICAL)
        
        input_box = wx.StaticBox(panel, label="1. Select Source PSS File")
        input_sizer = wx.StaticBoxSizer(input_box, wx.VERTICAL)
        hbox1 = wx.BoxSizer(wx.HORIZONTAL)
        self.pss_input_text = wx.TextCtrl(panel, style=wx.TE_READONLY)
        browse_input_btn = wx.Button(panel, label="Browse...")
        hbox1.Add(self.pss_input_text, 1, wx.EXPAND | wx.ALL, 5)
        hbox1.Add(browse_input_btn, 0, wx.ALL, 5)
        input_sizer.Add(hbox1, 1, wx.EXPAND)
        vbox.Add(input_sizer, 0, wx.EXPAND | wx.ALL, 5)
        browse_input_btn.Bind(wx.EVT_BUTTON, self.on_browse_pss_input)

        output_box = wx.StaticBox(panel, label="2. Specify Output MP4 File")
        output_sizer = wx.StaticBoxSizer(output_box, wx.VERTICAL)
        hbox2 = wx.BoxSizer(wx.HORIZONTAL)
        self.mp4_output_text = wx.TextCtrl(panel, style=wx.TE_READONLY)
        save_as_mp4_btn = wx.Button(panel, label="Save As...")
        hbox2.Add(self.mp4_output_text, 1, wx.EXPAND | wx.ALL, 5)
        hbox2.Add(save_as_mp4_btn, 0, wx.ALL, 5)
        output_sizer.Add(hbox2, 1, wx.EXPAND)
        vbox.Add(output_sizer, 0, wx.EXPAND | wx.ALL, 5)
        save_as_mp4_btn.Bind(wx.EVT_BUTTON, self.on_save_as_mp4)
        
        self.keep_files_mp4_checkbox = wx.CheckBox(panel, label="Keep Intermediate Files (.m2v, .ads, .wav)")
        vbox.Add(self.keep_files_mp4_checkbox, 0, wx.ALL, 10)

        self.convert_to_mp4_btn = wx.Button(panel, label="Convert to MP4")
        vbox.Add(self.convert_to_mp4_btn, 0, wx.EXPAND | wx.ALL, 5)
        self.convert_to_mp4_btn.Bind(wx.EVT_BUTTON, self.on_convert_to_mp4)
        
        panel.SetSizer(vbox)
        return panel
    
    def check_dependencies(self):
        missing = []
        for exe_path in [FFMPEG_EXE, PS2STR_EXE, VGMSTREAM_CLI_EXE]:
            if not os.path.exists(exe_path):
                missing.append(os.path.basename(exe_path))
        if missing:
            msg = f"Error: The following required files were not found:\n{', '.join(missing)}\n\nPlease check the file paths and the program's directory structure."
            self.show_error(msg)
            self.convert_to_pss_btn.Disable()
            self.convert_to_mp4_btn.Disable()

    def on_browse_mp4_input(self, event):
        wildcard = "Video Files|*.mp4;*.mkv;*.avi;*.mov|All Files|*.*"
        with wx.FileDialog(self, "Select Source Video File", wildcard=wildcard, style=wx.FD_OPEN | wx.FD_FILE_MUST_EXIST) as dialog:
            if dialog.ShowModal() == wx.ID_OK:
                path = dialog.GetPath()
                self.mp4_input_text.SetValue(path)
                self.pss_output_text.SetValue(os.path.splitext(path)[0] + ".pss")

    def on_save_as_pss(self, event):
        with wx.FileDialog(self, "Save PSS File", wildcard="PSS Files (*.pss)|*.pss", style=wx.FD_SAVE | wx.FD_OVERWRITE_PROMPT) as dialog:
            if dialog.ShowModal() == wx.ID_OK:
                self.pss_output_text.SetValue(dialog.GetPath())

    def on_convert_to_pss(self, event):
        input_file = self.mp4_input_text.GetValue()
        output_file = self.pss_output_text.GetValue()
        width = self.width_text.GetValue()
        height = self.height_text.GetValue()
        bitrate = self.bitrate_text.GetValue()
        keep_files = self.keep_files_pss_checkbox.IsChecked()

        if not all([input_file, output_file, width, height, bitrate]):
            self.show_error("All required fields must be filled!")
            return
        if not all(v.isdigit() and int(v) > 0 for v in [width, height, bitrate]):
            self.show_error("Resolution and bitrate must be valid numbers greater than 0!")
            return
        
        self.set_all_controls_state(False)
        self.log_text.Clear()
        threading.Thread(target=self.pss_conversion_worker, args=(input_file, output_file, width, height, bitrate, keep_files)).start()

    def on_browse_pss_input(self, event):
        with wx.FileDialog(self, "Select Source PSS File", wildcard="PSS Files (*.pss)|*.pss", style=wx.FD_OPEN | wx.FD_FILE_MUST_EXIST) as dialog:
            if dialog.ShowModal() == wx.ID_OK:
                path = dialog.GetPath()
                self.pss_input_text.SetValue(path)
                self.mp4_output_text.SetValue(os.path.splitext(path)[0] + ".mp4")

    def on_save_as_mp4(self, event):
        with wx.FileDialog(self, "Save MP4 File", wildcard="MP4 Files (*.mp4)|*.mp4", style=wx.FD_SAVE | wx.FD_OVERWRITE_PROMPT) as dialog:
            if dialog.ShowModal() == wx.ID_OK:
                self.mp4_output_text.SetValue(dialog.GetPath())

    def on_convert_to_mp4(self, event):
        input_file = self.pss_input_text.GetValue()
        output_file = self.mp4_output_text.GetValue()
        keep_files = self.keep_files_mp4_checkbox.IsChecked()
        if not all([input_file, output_file]):
            self.show_error("Both input and output paths must be specified!")
            return
        self.set_all_controls_state(False)
        self.log_text.Clear()
        threading.Thread(target=self.mp4_conversion_worker, args=(input_file, output_file, keep_files)).start()

    def pss_conversion_worker(self, input_file, output_file, width, height, bitrate, keep_files):
        base_path = os.path.splitext(output_file)[0]
        output_dir = os.path.dirname(output_file)
        m2v_file, wav_file, ads_file, mux_file = f"{base_path}.m2v", f"{base_path}.wav", f"{base_path}.ads", f"{base_path}.mux"
        intermediate_files = [m2v_file, wav_file, ads_file, mux_file]
        try:
            self.log_message("--- Step 1: FFMPEG is generating M2V and WAV ---\n")
            bitrate_k = f'{bitrate}k'
            cmd = [FFMPEG_EXE, '-i', input_file, '-c:v', 'mpeg2video', '-profile:v', '4', '-level:v', '8', '-b:v', bitrate_k, '-bufsize', '1835k', '-maxrate', bitrate_k, '-minrate', bitrate_k, '-color_range', 'tv', '-colorspace', 'smpte170m', '-color_trc', 'smpte170m', '-color_primaries', 'smpte170m', '-field_order', 'progressive', '-s', f'{width}x{height}', '-an', '-y', m2v_file, '-vn', '-acodec', 'pcm_s16le', '-ar', '48000', '-ac', '2', '-y', wav_file]
            if not self.run_command(cmd): raise Exception("FFMPEG execution failed!")
            
            self.log_message("\n--- Step 2: Injecting metadata into M2V file ---\n")
            success, message = inject_metadata_to_m2v(m2v_file)
            self.log_message(message + "\n")
            if not success: raise Exception("Failed to inject metadata into M2V file!")

            self.log_message("\n--- Step 3: Appending sequence end code to M2V file ---\n")
            success, message = append_sequence_end_code_if_missing(m2v_file)
            self.log_message(message + "\n")
            if not success: raise Exception("Failed to append end code to M2V file!")

            self.log_message("\n--- Step 4: PS2STR is generating ADS audio ---\n")
            ps2str_e_cmd = [PS2STR_EXE, 'e', '-o', '-v', '-d', output_dir, wav_file]
            if not self.run_command(ps2str_e_cmd): raise Exception("PS2STR audio encoding failed!")

            self.log_message(f"\n--- Step 5: Creating project file {os.path.basename(mux_file)} ---\n")
            with open(mux_file, 'w', encoding='utf-8') as f:
                f.write(f'pss\n\n\tstream video:0\n\t\tinput "{os.path.abspath(m2v_file)}"\n\tend\n\n\tstream pcm:0\n\t\tinput "{os.path.abspath(ads_file)}"\n\tend\nend\n')
            self.log_message("Project file created successfully.\n")
            
            self.log_message("\n--- Step 6: PS2STR is multiplexing PSS file ---\n")
            ps2str_m_cmd = [PS2STR_EXE, 'm', '-o', '-v', '-d', output_dir, mux_file]
            if not self.run_command(ps2str_m_cmd): raise Exception("PS2STR PSS multiplexing failed!")
            
            self.log_message("\n[SUCCESS] Conversion to PSS completed successfully!\n")
            wx.CallAfter(self.show_info, f"Conversion successful!\nFile saved to:\n{output_file}")
        except Exception as e:
            self.log_message(f"\n[ERROR] An error occurred during conversion: {e}\n")
            wx.CallAfter(self.show_error, f"Conversion failed!\nPlease check the log for details.")
        finally:
            if not keep_files: self.cleanup_files(intermediate_files)
            wx.CallAfter(self.set_all_controls_state, True)

    def mp4_conversion_worker(self, input_pss, output_mp4, keep_files):
        pss_dir = os.path.dirname(input_pss)
        base_name = os.path.splitext(os.path.basename(input_pss))[0]
        m2v_file = os.path.join(pss_dir, f"{base_name}_video_0.m2v")
        ads_file = os.path.join(pss_dir, f"{base_name}_pcm_0.ads")
        wav_file = os.path.join(pss_dir, f"{base_name}_temp.wav")
        intermediate_files = [m2v_file, ads_file, wav_file]
        try:
            self.log_message("--- Step 1: PS2STR is demultiplexing PSS file ---\n")
            demux_cmd = [PS2STR_EXE, 'd', '-o', '-v', '-d', pss_dir, input_pss]
            if not self.run_command(demux_cmd): raise Exception("PS2STR demultiplexing failed!")
            
            self.log_message("\n--- Step 2: vgmstream-cli is converting audio ---\n")
            vgmstream_cmd = [VGMSTREAM_CLI_EXE, '-o', wav_file, ads_file]
            if not self.run_command(vgmstream_cmd): raise Exception("vgmstream-cli audio conversion failed!")
            
            self.log_message("\n--- Step 3: FFMPEG is multiplexing MP4 file ---\n")
            cmd = [FFMPEG_EXE, '-i', m2v_file, '-i', wav_file, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-y', output_mp4]
            if not self.run_command(cmd): raise Exception("FFMPEG MP4 multiplexing failed!")
            
            self.log_message("\n[SUCCESS] Conversion to MP4 completed successfully!\n")
            wx.CallAfter(self.show_info, f"Conversion successful!\nFile saved to:\n{output_mp4}")
        except Exception as e:
            self.log_message(f"\n[ERROR] An error occurred during conversion: {e}\n")
            wx.CallAfter(self.show_error, f"Conversion failed!\nPlease check the log for details.")
        finally:
            if not keep_files: self.cleanup_files(intermediate_files)
            wx.CallAfter(self.set_all_controls_state, True)

    def cleanup_files(self, file_list):
        self.log_message("\n--- Cleaning up temporary files ---\n")
        for f in file_list:
            try:
                if os.path.exists(f): os.remove(f)
            except Exception: pass
    
    def set_all_controls_state(self, enabled):
        for panel in [self.mp4_to_pss_panel, self.pss_to_mp4_panel]:
            for child in panel.GetChildren():
                if isinstance(child, (wx.Button, wx.TextCtrl, wx.CheckBox, wx.StaticBox)):
                    if isinstance(child, wx.StaticBox):
                         for grandchild in child.GetChildren():
                             if hasattr(grandchild, 'Enable'): grandchild.Enable(enabled)
                    else:
                        child.Enable(enabled)

    def run_command(self, command):
        self.log_message(f"Executing: {' '.join(command)}\n\n")
        startupinfo = None
        if os.name == 'nt':
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        process = subprocess.Popen(
            command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding='utf-8', errors='replace', startupinfo=startupinfo
        )
        for line in iter(process.stdout.readline, ''):
            wx.CallAfter(self.log_message, line)
        process.wait()
        return process.returncode == 0

    def log_message(self, message): self.log_text.AppendText(message)
    def show_error(self, message): wx.MessageBox(message, "Error", wx.OK | wx.ICON_ERROR)
    def show_info(self, message): wx.MessageBox(message, "Information", wx.OK | wx.ICON_INFORMATION)

if __name__ == '__main__':
    app = wx.App(False)
    frame = PSSConverterFrame(None)
    app.MainLoop()