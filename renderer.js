document.addEventListener('DOMContentLoaded', async () => {
  // --- Theme Switcher ---
  document.getElementById('themeDefault').onclick = () => setTheme('light');
  document.getElementById('themeSunset').onclick = () => setTheme('sunset');
  document.getElementById('themeMoon').onclick = () => setTheme('moon');
  document.getElementById('themeWhDark').onclick = () => setTheme('wh-dark');
  document.getElementById('themeGlowMoon').onclick = () => setTheme('glow-moon');

  function setTheme(theme) {
    document.body.className = theme;
    localStorage.setItem('theme', theme);
  }
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) document.body.className = savedTheme;

  // --- Folder Selectors for <10min and >=10min ---
  const folderShortSpan = document.getElementById('folderShortPath');
  const folderLongSpan = document.getElementById('folderLongPath');
  const browseShortBtn = document.getElementById('browseShortFolderBtn');
  const browseLongBtn = document.getElementById('browseLongFolderBtn');
  const folderPopup = document.getElementById('folderPopup');

  let folderShort = localStorage.getItem('folderShort') || '';
  let folderLong = localStorage.getItem('folderLong') || '';

  // Set default to Downloads folder on first run
  if ((!folderShort || !folderLong) && window.api && window.api.getDownloadsFolder) {
    const downloads = await window.api.getDownloadsFolder();
    if (!folderShort) {
      folderShort = downloads;
      localStorage.setItem('folderShort', downloads);
    }
    if (!folderLong) {
      folderLong = downloads;
      localStorage.setItem('folderLong', downloads);
    }
  }

  function updateFolderUI() {
    folderShortSpan.style.display = folderShort ? 'none' : '';
    folderShortSpan.textContent = folderShort ? '' : 'Not set';
    folderLongSpan.style.display = folderLong ? 'none' : '';
    folderLongSpan.textContent = folderLong ? '' : 'Not set';
  }
  updateFolderUI();

  function showFolderPopup() {
    folderPopup.style.display = '';
    setTimeout(() => { folderPopup.style.display = 'none'; }, 1200);
  }

  browseShortBtn.onclick = async () => {
    if (window.api && window.api.selectFolder) {
      const folder = await window.api.selectFolder();
      if (folder) {
        folderShort = folder;
        localStorage.setItem('folderShort', folder);
        updateFolderUI();
        showFolderPopup();
      }
    }
  };
  browseLongBtn.onclick = async () => {
    if (window.api && window.api.selectFolder) {
      const folder = await window.api.selectFolder();
      if (folder) {
        folderLong = folder;
        localStorage.setItem('folderLong', folder);
        updateFolderUI();
        showFolderPopup();
      }
    }
  };

  // --- Dynamic Download Boxes ---
  const urlBoxes = document.getElementById('urlBoxes');
  const boxes = [];
  const MAX_BOXES = 4;

  function createBox(idx) {
    const box = document.createElement('div');
    box.className = 'urlBox';
    box.style.display = idx < 2 ? '' : 'none';

    box.innerHTML = `
      <input type="text" placeholder="Paste URL ${idx+1} or drag here…" style="flex:1;">
      <button>📋 Paste</button>
      <button class="fetchBtn">🔍 Fetch</button>
      <button class="clearBtn">❌</button>
      <input type="checkbox" id="audioOnly${idx}">
      <label for="audioOnly${idx}">Audio Only</label>
      <div class="infoPanel"></div>
      <div class="progress-bar"><div></div></div>
    `;

    const input = box.querySelector('input[type="text"]');
    const pasteBtn = box.querySelector('button');
    const fetchBtn = box.querySelector('.fetchBtn');
    const clearBtn = box.querySelector('.clearBtn');
    const infoPanel = box.querySelector('.infoPanel');
    const progBar = box.querySelector('.progress-bar > div');
    const audioOnly = box.querySelector(`#audioOnly${idx}`);

    // Paste button
    if (pasteBtn) {
      pasteBtn.onclick = async () => {
        if (window.api && window.api.pasteClipboard) {
          input.value = await window.api.pasteClipboard();
          input.dispatchEvent(new Event('input'));
        } else if (navigator.clipboard) {
          try {
            input.value = await navigator.clipboard.readText();
            input.dispatchEvent(new Event('input'));
          } catch (e) {
            alert('Clipboard access denied.');
          }
        } else {
          alert('Clipboard API not available.');
        }
      };
    }

    // Show next box if user types or pastes in this one
    input.addEventListener('input', () => {
      if (input.value.trim() && idx + 1 < MAX_BOXES) {
        boxes[idx + 1].style.display = '';
      }
    });

    // Drag-and-drop
    input.ondragover = e => { e.preventDefault(); input.classList.add('drag'); };
    input.ondragleave = e => { input.classList.remove('drag'); };
    input.ondrop = e => {
      e.preventDefault();
      input.classList.remove('drag');
      input.value = e.dataTransfer.getData('text');
      input.dispatchEvent(new Event('input'));
    };

    // Clear button
    clearBtn.onclick = () => {
      input.value = '';
      infoPanel.innerHTML = '';
      progBar.style.width = '0';
      progBar.style.background = '#e53935';
    };

    // Progress bar color change function
    box.setProgress = percent => {
      progBar.style.width = percent + '%';
      if (percent < 50) progBar.style.background = '#e53935';
      else if (percent < 80) progBar.style.background = '#fbc02d';
      else progBar.style.background = '#43a047';
    };

    // --- Fetch video info ---
    fetchBtn.onclick = async () => {
      const url = input.value.trim();
      if (!url) return alert('Please enter a URL.');
      fetchBtn.disabled = true;
      fetchBtn.innerText = 'Fetching...';
      infoPanel.innerHTML = '';
      try {
        const info = await window.api.fetchInfo(url);
        if (info.error) {
          infoPanel.innerHTML = `<span style="color:red;">${info.error}</span>`;
          return;
        }
        // Show info
        infoPanel.innerHTML = `
          <img src="${info.thumbnail}" class="thumbnail" width="160" height="120"><br>
          <b>${info.title}</b><br>
          Uploader: ${info.uploader || ''}<br>
          Views: ${info.view_count || ''}<br>
          Likes: ${info.like_count || ''}<br>
          Date: ${info.upload_date || ''}<br>
          Duration: ${info.duration ? Math.floor(info.duration/60)+':'+(info.duration%60).toString().padStart(2,'0') : ''}<br>
          <label>Format: <select class="formatSelect"></select></label>
          <span class="sizeLbl"></span><br>
          <button class="downloadBtn primary">⬇ Download</button>
        `;
        // Fill formats
        const select = infoPanel.querySelector('.formatSelect');
        info.formats.forEach(f => {
          const opt = document.createElement('option');
          opt.value = f.id;
          opt.dataset.size = f.size;
          opt.innerText = `${f.ext} – ${f.resolution || ''}${f.isAudio ? ' (audio)' : ''}`;
          select.append(opt);
        });
        select.value = info.chosen;
        // Show size
        const sizeLbl = infoPanel.querySelector('.sizeLbl');
        function updateSize() {
          const s = select.selectedOptions[0].dataset.size;
          sizeLbl.innerText = s ? `Size: ${(s/1024/1024).toFixed(2)} MB` : '';
        }
        select.onchange = updateSize;
        updateSize();

        // Download button
        const downloadBtn = infoPanel.querySelector('.downloadBtn');
        downloadBtn.onclick = () => {
          // Choose folder based on duration
          const dest = (info.duration < 600 ? folderShort : folderLong) || info.dest;
          let format = select.value;
          if (!audioOnly.checked) {
            // If the selected format is a video-only format, combine with bestaudio
            const selectedFormat = info.formats.find(f => f.id === format);
            if (selectedFormat && !selectedFormat.isAudio) {
              format = `${format}+bestaudio`;
            }
          }
          window.api.enqueue({
            url: url,
            filename: info.truncated,
            format: audioOnly.checked ? 'bestaudio' : format,
            ext: audioOnly.checked ? 'mp3' : (select.selectedOptions[0]?.innerText.includes('audio') ? 'mp3' : undefined),
            dest: dest,
            box: idx
          });
          infoPanel.innerHTML = '';
          input.value = '';
          progBar.style.width = '0';
          progBar.style.background = '#e53935';
        };
      } catch (e) {
        infoPanel.innerHTML = `<span style="color:red;">${e.message}</span>`;
      } finally {
        fetchBtn.disabled = false;
        fetchBtn.innerText = '🔍 Fetch';
      }
    };

    return box;
  }

  for (let i = 0; i < MAX_BOXES; i++) {
    const box = createBox(i);
    boxes.push(box);
    urlBoxes.append(box);
  }

  // --- Download Progress ---
  window.api && window.api.onProgress && window.api.onProgress(p => {
    const box = boxes[p.box];
    if (box) box.setProgress(p.percent || 0);
  });
  window.api && window.api.onError && window.api.onError(p => {
    const box = boxes[p.box];
    if (box) {
      box.setProgress(0);
      alert('Download error: ' + p.err);
    }
  });
  window.api && window.api.onComplete && window.api.onComplete(p => {
    const box = boxes[p.box];
    if (box) {
      box.setProgress(100);
      setTimeout(() => {
        box.setProgress(0);
        // If box 3 or 4, clear and hide it
        if (p.box >= 2) {
          box.querySelector('input[type="text"]').value = '';
          box.querySelector('.infoPanel').innerHTML = '';
          box.style.display = 'none';
        }
        // If only 2 boxes in use, show only 2
        if (!boxes[2].querySelector('input[type="text"]').value && !boxes[3].querySelector('input[type="text"]').value) {
          boxes[2].style.display = 'none';
          boxes[3].style.display = 'none';
        }
      }, 1000);
    }
    notify("Download Complete", p.filename);
  });

  // --- Download Queue Management ---
  const queueList = document.getElementById('queueList');
  const clearBtn = document.getElementById('clearBtn');
  let queueItems = {};

  window.api && window.api.onQueued && window.api.onQueued(({id, job}) => {
    const li = document.createElement('li');
    li.id = 'job' + id;
    li.innerHTML = `
      <b>${job.filename}</b>
      <span id="status${id}">Queued</span>
      <span id="speed${id}" style="margin-left:1em;color:#888;"></span>
      <div class="liquid-progress-bar" id="liquidBar${id}">
        <div class="liquid-bar-inner" id="liquidBarInner${id}">
          <span class="liquid-bar-percent" id="liquidBarPercent${id}">0%</span>
        </div>
      </div>
    `;
    queueList.appendChild(li);
    queueItems[id] = li;
  });

  window.api && window.api.onProgress && window.api.onProgress(p => {
    const st = document.getElementById('status' + p.id);
    if (st) st.innerText = `Downloading ${p.percent?.toFixed(1) || 0}%`;
    const sp = document.getElementById('speed' + p.id);
    if (sp) sp.innerText = p.speed ? `@ ${p.speed}/s` : '';
    const bar = document.getElementById('liquidBarInner' + p.id);
    const percent = document.getElementById('liquidBarPercent' + p.id);
    if (bar) {
      bar.style.width = (p.percent || 0) + '%';
      if (p.percent < 50) bar.style.background = 'linear-gradient(90deg,#e53935,#fbc02d)';
      else if (p.percent < 80) bar.style.background = 'linear-gradient(90deg,#fbc02d,#43a047)';
      else bar.style.background = 'linear-gradient(90deg,#43a047,#43a047)';
    }
    if (percent) percent.textContent = `${Math.round(p.percent || 0)}%`;
  });

  window.api && window.api.onError && window.api.onError(p => {
    const st = document.getElementById('status' + p.id);
    if (st) st.innerText = `❌ ${p.err}`;
    const bar = document.getElementById('liquidBarInner' + p.id);
    const percent = document.getElementById('liquidBarPercent' + p.id);
    if (bar) bar.style.background = 'linear-gradient(90deg,#e53935,#e53935)';
    if (percent) percent.textContent = 'Error';
    clearBtn.style.display = '';
  });

  window.api && window.api.onComplete && window.api.onComplete(p => {
    const st = document.getElementById('status' + p.id);
    if (st) st.innerText = '✅ Completed';
    const bar = document.getElementById('liquidBarInner' + p.id);
    const percent = document.getElementById('liquidBarPercent' + p.id);
    if (bar) {
      bar.style.width = '100%';
      bar.style.background = 'linear-gradient(90deg,#43a047,#43a047)';
    }
    if (percent) percent.textContent = '100%';
    clearBtn.style.display = '';
    setTimeout(() => {
      const li = queueItems[p.id];
      if (li) li.remove();
      delete queueItems[p.id];
      if (!Object.keys(queueItems).length) clearBtn.style.display = 'none';
    }, 5000);
  });

  clearBtn.onclick = () => {
    Object.values(queueItems).forEach(li => {
      if (li.innerText.includes('✅')) li.remove();
    });
    clearBtn.style.display = 'none';
  };

  // --- History Modal (UI only) ---
  const historyModal = document.getElementById('historyModal');
  const showHistoryBtn = document.getElementById('showHistoryBtn');
  const closeHistory = document.getElementById('closeHistory');
  const historyList = document.getElementById('historyList');
  if (showHistoryBtn && historyModal && closeHistory) {
    showHistoryBtn.onclick = async () => {
      historyModal.style.display = '';
      historyModal.classList.add('active');
      historyList.innerHTML = '<li>Loading...</li>';
      if (window.api && window.api.getHistory) {
        const history = await window.api.getHistory();
        historyList.innerHTML = '';
        if (!history.length) {
          historyList.innerHTML = '<li>No downloads yet.</li>';
        } else {
          history.slice().reverse().forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `<b>${item.filename}</b> <span style="color:#888;">(${item.date.replace('T',' ').slice(0,19)})</span>`;
            historyList.appendChild(li);
          });
        }
      }
    };
    closeHistory.onclick = () => { historyModal.style.display = 'none'; historyModal.classList.remove('active'); };
    window.onclick = e => { if (e.target === historyModal) historyModal.style.display = 'none'; };
  }

  // --- Notifications ---
  function notify(title, body) {
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    }
  }
  if (Notification.permission !== "granted") Notification.requestPermission();
});
