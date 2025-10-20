async function loadImages(sheetUrl) {
  const res = await fetch(sheetUrl);
  const text = await res.text();
  const rows = text.split('\n').map(r => r.split(','));
  const urls = rows.flat().filter(u => u.startsWith('http'));

  const gallery = document.getElementById('gallery');
  gallery.innerHTML = '';
  urls.forEach(url => {
    const img = document.createElement('img');
    img.src = url.trim();
    img.className = 'thumbnail';
    gallery.appendChild(img);
  });

  document.getElementById('downloadAll').onclick = () => downloadAll(urls);
}

async function downloadAll(urls) {
  const zip = new JSZip();
  const folder = zip.folder('images');
  const progressDiv = document.getElementById('progress');
  const downloadBtn = document.getElementById('downloadAll');

  // Disable button and show progress
  downloadBtn.disabled = true;
  progressDiv.style.display = 'block';

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i].trim();
    progressDiv.textContent = `Downloading ${i + 1} of ${urls.length}...`;

    try {
      // Use CORS proxy to bypass CORS restrictions
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();

      // Extract filename from URL or use default
      const filename = url.split('/').pop().split('?')[0] || `image_${i + 1}.jpg`;
      folder.file(filename, blob);
      successCount++;
    } catch (error) {
      console.error(`Failed to download ${url}:`, error);
      failCount++;
    }
  }

  if (successCount === 0) {
    progressDiv.textContent = `Failed to download any images. Check console for errors.`;
    progressDiv.style.color = 'red';
    downloadBtn.disabled = false;
    return;
  }

  progressDiv.textContent = `Creating zip file...`;
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'images.zip');

  progressDiv.textContent = `Done! Downloaded ${successCount} images${failCount > 0 ? ` (${failCount} failed)` : ''}.`;
  progressDiv.style.color = successCount > 0 ? 'green' : 'red';
  downloadBtn.disabled = false;
}

document.getElementById('loadBtn').addEventListener('click', () => {
  const sheetUrl = document.getElementById('sheetUrl').value;
  loadImages(sheetUrl);
});
