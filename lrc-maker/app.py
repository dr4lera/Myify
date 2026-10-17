"""Myify LRC Maker: CPU-only, local transcription desktop app."""
import os
import queue
import threading
from pathlib import Path
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from tkinter.scrolledtext import ScrolledText
from lrc_engine import MODELS, VERSION, Cancelled, load_model, transcribe, save_unique

class App:
    def __init__(self, root):
        self.root = root
        root.title('Myify LRC Maker')
        root.geometry('960x760')
        root.minsize(760, 620)
        root.configure(bg='#111819')
        style = ttk.Style()
        style.theme_use('clam')
        style.configure('.', background='#172122', foreground='#f4f6f6', font=('Segoe UI', 10))
        style.configure('TButton', padding=(12, 8))
        style.configure('Accent.TButton', background='#86edac', foreground='#102016')
        style.configure('TEntry', fieldbackground='#ffffff', foreground='#101817')
        style.configure('TCombobox', fieldbackground='#ffffff', foreground='#101817')
        self.events = queue.Queue()
        self.stop = threading.Event()
        self.busy = False
        self.files = []
        self.results = []
        self.output = tk.StringVar(value=str(Path.home()/'Music'/'LRC'))
        self.model = tk.StringVar(value='base.en')
        self.language = tk.StringVar(value='en')
        self.offline = tk.BooleanVar(value=True)
        self.status = tk.StringVar(value='English base.en and small.en included. Ready offline. Add audio files to begin.')
        self.cache = Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'MyifyLRC' / 'models'
        frame = ttk.Frame(root, padding=24)
        frame.pack(fill='both', expand=True)
        ttk.Label(frame, text='Myify LRC Maker', font=('Segoe UI', 24, 'bold')).pack(anchor='w')
        ttk.Label(frame, text='Audio in. Timed lyrics out. Runs on your computer.').pack(anchor='w', pady=(4,14))
        row = ttk.Frame(frame);row.pack(fill='x')
        self.add_button = ttk.Button(row, text='Add songs', command=self.add);self.add_button.pack(side='left')
        self.clear_button = ttk.Button(row, text='Clear list', command=self.clear);self.clear_button.pack(side='left', padx=8)
        self.listbox = tk.Listbox(frame, height=4, bg='#101718', fg='#f4f6f6', selectbackground='#315945', relief='flat', font=('Segoe UI',10))
        self.listbox.pack(fill='x', pady=10)
        row = ttk.Frame(frame);row.pack(fill='x', pady=6)
        ttk.Label(row,text='Save LRC files to:').pack(side='left')
        ttk.Entry(row,textvariable=self.output).pack(side='left',fill='x',expand=True,padx=10)
        ttk.Button(row,text='Browse',command=self.browse).pack(side='left')
        row = ttk.Frame(frame);row.pack(fill='x', pady=8)
        ttk.Label(row,text='Model:').pack(side='left')
        ttk.Combobox(row,textvariable=self.model,values=MODELS,state='readonly',width=18).pack(side='left',padx=(8,20))
        ttk.Label(row,text='Language:').pack(side='left')
        ttk.Combobox(row,textvariable=self.language,values=('Auto','en','es','fr','de','it','pt','ja','ko','zh','ru','ar','hi'),state='readonly',width=8).pack(side='left',padx=8)
        ttk.Checkbutton(frame,text='Offline only (included English models are ready)',variable=self.offline).pack(anchor='w')
        ttk.Label(frame,text='English models end in .en. For other languages choose base / small and Auto.\nBase is quicker; small is more accurate and slower. Large models need much more RAM.').pack(anchor='w',pady=6)
        row = ttk.Frame(frame);row.pack(fill='x',pady=8)
        self.start_button=ttk.Button(row,text='Create LRC files',style='Accent.TButton',command=self.start);self.start_button.pack(side='left')
        self.cancel_button=ttk.Button(row,text='Cancel after current chunk',command=self.cancel,state='disabled');self.cancel_button.pack(side='left',padx=8)
        ttk.Button(row,text='Open output folder',command=self.open_output).pack(side='right')
        self.progress=ttk.Progressbar(frame,mode='indeterminate');self.progress.pack(fill='x',pady=6)
        ttk.Label(frame,textvariable=self.status,wraplength=850).pack(anchor='w',pady=5)
        ttk.Label(frame,text='Preview / edit the last result',font=('Segoe UI',11,'bold')).pack(anchor='w',pady=(10,4))
        self.preview=ScrolledText(frame,height=9,bg='#0f1617',fg='#f4f6f6',insertbackground='white',font=('Consolas',10),relief='flat')
        self.preview.pack(fill='both',expand=True)
        ttk.Button(frame,text='Save edited preview as...',command=self.save_preview).pack(anchor='e',pady=(8,0))
        ttk.Label(frame,text='Automatic recognition can miss words or invent lyrics over instruments. Review before importing.\nEnglish base.en and small.en are included. Other models need a download.').pack(anchor='w',pady=(8,0))
        root.protocol('WM_DELETE_WINDOW',self.close)
        root.after(100,self.poll)

    def add(self):
        paths=filedialog.askopenfilenames(title='Choose audio',filetypes=[('Audio','*.mp3 *.flac *.wav *.m4a *.aac *.ogg *.opus *.wma *.aiff'),('All files','*.*')])
        for path in paths:
            if path not in self.files:self.files.append(path);self.listbox.insert('end',path)
    def clear(self):
        if not self.busy:self.files.clear();self.listbox.delete(0,'end')
    def browse(self):
        folder=filedialog.askdirectory(title='LRC output folder')
        if folder:self.output.set(folder)
    def open_output(self):
        try:
            folder=Path(self.output.get()).expanduser().resolve();folder.mkdir(parents=True,exist_ok=True);os.startfile(folder)
        except Exception as exc:messagebox.showerror('Output folder',str(exc))
    def start(self):
        if self.busy:return
        if not self.files:messagebox.showinfo('Add songs','Choose at least one audio file first.');return
        model,language=self.model.get(),self.language.get()
        if model.endswith('.en') and language not in ('en','Auto'):messagebox.showerror('Model language','Choose a multilingual model such as base for this language.');return
        if not self.output.get().strip():messagebox.showerror('Output folder','Choose an output folder.');return
        try:Path(self.output.get()).expanduser().mkdir(parents=True,exist_ok=True)
        except Exception as exc:messagebox.showerror('Output folder',str(exc));return
        self.busy=True;self.stop.clear();self.results=[]
        for button in (self.start_button,self.add_button,self.clear_button):button.configure(state='disabled')
        self.cancel_button.configure(state='normal');self.progress.start(12)
        args=(list(self.files),str(Path(self.output.get()).expanduser()),model,language,self.offline.get())
        threading.Thread(target=self.worker,args=args,daemon=True).start()
    def worker(self,files,folder,name,language,offline):
        errors=[]
        def notify(message):self.events.put(('status',message))
        try:
            model=load_model(name,self.cache,offline,notify)
            for index,file in enumerate(files):
                if self.stop.is_set():raise Cancelled()
                try:
                    def update(message):notify(f'{index+1}/{len(files)} - {Path(file).name}: {message}')
                    text,detected=transcribe(model,file,language,self.stop,update)
                    output=save_unique(folder,Path(file).stem,text)
                    self.events.put(('result',(str(output),text)))
                except Cancelled:raise
                except Exception as exc:errors.append(f'{Path(file).name}: {exc}')
            self.events.put(('done',errors))
        except Cancelled:self.events.put(('cancelled',None))
        except Exception as exc:self.events.put(('error',str(exc)))
    def cancel(self):self.stop.set();self.status.set('Cancelling after the current model load/audio chunk finishes...')
    def finish(self):
        self.busy=False;self.progress.stop();self.cancel_button.configure(state='disabled')
        for button in (self.start_button,self.add_button,self.clear_button):button.configure(state='normal')
    def poll(self):
        try:
            while True:
                kind,value=self.events.get_nowait()
                if kind=='status':self.status.set(value)
                elif kind=='result':
                    path,text=value;self.results.append(path);self.preview.delete('1.0','end');self.preview.insert('1.0',text);self.status.set('Saved: '+path)
                elif kind=='done':
                    self.finish();self.status.set(f'Finished. Saved {len(self.results)} LRC file(s) to {self.output.get()}.')
                    if value:messagebox.showwarning('Some files failed','\n\n'.join(value))
                    else:messagebox.showinfo('LRC files ready',f'Saved {len(self.results)} file(s).\n\n'+ '\n'.join(self.results))
                elif kind=='cancelled':self.finish();self.status.set(f'Cancelled. {len(self.results)} completed file(s) were kept.')
                elif kind=='error':
                    self.finish();self.status.set('Could not load or run the model.')
                    messagebox.showerror('Model error',value+'\n\nSelect base.en or small.en to use an included English model without a download. Songs are never uploaded.')
        except queue.Empty:pass
        self.root.after(100,self.poll)
    def save_preview(self):
        text=self.preview.get('1.0','end-1c')
        if not text.strip():return
        path=filedialog.asksaveasfilename(defaultextension='.lrc',filetypes=[('LRC lyrics','*.lrc')],initialfile=Path(self.results[-1]).name if self.results else 'lyrics.lrc')
        if path:
            try:Path(path).write_text(text,encoding='utf-8');self.status.set('Saved: '+path)
            except Exception as exc:messagebox.showerror('Save failed',str(exc))
    def close(self):
        if self.busy and not messagebox.askyesno('Close Myify LRC Maker?','A job is running. Closing stops it; completed LRC files are kept.'):return
        self.stop.set();self.root.destroy()

def main():
    import argparse
    import json
    import sys
    parser=argparse.ArgumentParser(description='Create LRC files locally from audio.')
    parser.add_argument('--transcribe', nargs='+')
    parser.add_argument('--output-dir')
    parser.add_argument('--model', default='base.en', choices=MODELS)
    parser.add_argument('--model-dir')
    parser.add_argument('--offline', action='store_true')
    parser.add_argument('--report')
    options=parser.parse_args()
    os.environ.setdefault('HF_HUB_DISABLE_PROGRESS_BARS','1')
    if not options.transcribe:
        App(tk.Tk()).root.mainloop()
        return
    report={'version':VERSION,'files':[],'errors':[]}
    try:
        cache=Path(options.model_dir) if options.model_dir else Path(os.environ.get('LOCALAPPDATA',str(Path.home())))/'MyifyLRC'/'models'
        model=load_model(options.model,cache,options.offline)
        for file in options.transcribe:
            text,language=transcribe(model,file,'Auto',threading.Event())
            output=save_unique(options.output_dir or str(Path(file).parent),Path(file).stem,text)
            report['files'].append({'path':str(output),'language':language})
    except Exception as exc:
        import traceback
        report['errors'].append(traceback.format_exc())
    if options.report:Path(options.report).write_text(json.dumps(report,indent=2),encoding='utf-8')
    elif sys.stdout:print(json.dumps(report,indent=2))
    if report['errors']:sys.exit(1)

if __name__=='__main__':
    main()
