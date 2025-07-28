const { app, BrowserWindow, ipcMain, clipboard, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { YtDlp } = require('ytdlp-nodejs');

let win;
const ytdlp = new YtDlp();
const historyPath = path.join(app.getPath('userData'), 'history.json');
let queue = [], busy = false;
let downloadProcesses = {};

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 490,
    height: 810,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });
  win.loadFile('renderer.html');
});

ipcMain.handle('paste-clipboard', () => clipboard.readText());

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('get-downloads-folder', () => {
  return app.getPath('downloads');
});

function addToHistory(entry) {
  let history = [];
  if (fs.existsSync(historyPath)) {
    try {
      history = JSON.parse(fs.readFileSync(historyPath));
    } catch (e) {
      history = [];
    }
  }
  history.push(entry);
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}
ipcMain.handle('get-history', () => {
  if (fs.existsSync(historyPath)) {
    try {
      return JSON.parse(fs.readFileSync(historyPath));
    } catch (e) {
      fs.unlinkSync(historyPath);
      return [];
    }
  }
  return [];
});

ipcMain.handle('fetch-info', async (_e, url) => {
  try {
    const info = await ytdlp.getInfoAsync(url, { flatPlaylist: false });
    const secs = info.duration || 0;
    const destFolder = app.getPath('downloads');
    const formats = (info.formats || []).filter(f => f.format_id && f.filesize);
    const bestVideo = formats.find(f => /bestvideo/.test(f.format_id));
    const chosen = bestVideo
      ? `${bestVideo.format_id}+bestaudio`
      : formats.sort((a, b) => b.filesize - a.filesize)[0]?.format_id || 'best';
    return {
      thumbnail: info.thumbnail,
      title: info.title,
      truncated: info.title ? info.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 122) : '',
      duration: secs,
      dest: destFolder,
      formats: formats.map(f => ({
        id: f.format_id,
        ext: f.ext,
        resolution: f.format_note || f.resolution,
        size: f.filesize,
        isAudio: f.vcodec === 'none'
      })),
      chosen,
      uploader: info.uploader,
      view_count: info.view_count,
      like_count: info.like_count,
      upload_date: info.upload_date
    };
  } catch (err) {
    return { error: err.message || 'Failed to fetch info' };
  }
});

ipcMain.handle('enqueue-download', (_e, job) => {
  const id = Date.now() + Math.random();
  queue.push({ ...job, id });
  win.webContents.send('download-queued', { id, job });
  processQueue();
});

ipcMain.handle('pause-download', (_e, id) => {
  if (downloadProcesses[id]) {
    try {
      downloadProcesses[id].kill('SIGSTOP');
    } catch (e) {}
  }
});
ipcMain.handle('resume-download', (_e, id) => {
  if (downloadProcesses[id]) {
    try {
      downloadProcesses[id].kill('SIGCONT');
    } catch (e) {}
  }
});
ipcMain.handle('cancel-download', (_e, id) => {
  if (downloadProcesses[id]) {
    try {
      downloadProcesses[id].kill('SIGKILL');
    } catch (e) {}
  }
});

async function processQueue() {
  if (busy || queue.length === 0) return;
  busy = true;
  const job = queue.shift();
  const out = path.join(job.dest, job.filename + '.%(ext)s');
  let args = [
    job.url,
    '-o', out,
    '--no-part',
    '-N', '8'
  ];
  if (job.format === 'bestaudio') {
    args.push('-f', 'bestaudio');
    args.push('--extract-audio');
    args.push('--audio-format', job.ext || 'mp3');
  } else {
    args.push('-f', job.format || 'bestvideo+bestaudio/best');
    args.push('--merge-output-format', job.ext || 'mp4');
  }
  const em = ytdlp.exec(args);
  downloadProcesses[job.id] = em.child;

  em.on('progress', p => {
    // Robust percent calculation
    let percent = p.percent;
    if (typeof percent !== 'number' && p.downloaded_bytes && p.total_bytes) {
      percent = (p.downloaded_bytes / p.total_bytes) * 100;
    }
    let speed = '';
    if (p.speed) {
      if (p.speed > 1024 * 1024)
        speed = (p.speed / 1024 / 1024).toFixed(2) + ' MB';
      else if (p.speed > 1024)
        speed = (p.speed / 1024).toFixed(1) + ' KB';
      else
        speed = p.speed + ' B';
    }
    win.webContents.send('download-progress', { id: job.id, box: job.box, ...p, percent, speed });
  });
  em.on('error', e => {
    win.webContents.send('download-error', { id: job.id, box: job.box, err: e.toString() });
    busy = false;
    delete downloadProcesses[job.id];
    processQueue();
  });
  em.on('close', () => {
    win.webContents.send('download-complete', { id: job.id, box: job.box, filename: job.filename });
    addToHistory({ filename: job.filename, url: job.url, date: new Date().toISOString() });
    busy = false;
    delete downloadProcesses[job.id];
    processQueue();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
