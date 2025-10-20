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

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const response = await fetch(url);
    const blob = await response.blob();
    folder.file(`image_${i + 1}.jpg`, blob);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'images.zip');
}

document.getElementById('loadBtn').addEventListener('click', () => {
  const sheetUrl = document.getElementById('sheetUrl').value;
  loadImages(sheetUrl);
});
