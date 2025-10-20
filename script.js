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

// Download a single image with retry logic
async function downloadImage(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(30000) });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const filename = url.split('/').pop().split('?')[0] || `image_${Date.now()}.jpg`;
      return { success: true, blob, filename, url };
    } catch (error) {
      if (attempt === retries) {
        console.error(`Failed to download ${url} after ${retries} attempts:`, error.message);
        return { success: false, error: error.message, url };
      }
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// Download images concurrently in batches
async function downloadBatch(urls, batchSize = 10) {
  const results = [];

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(url => downloadImage(url.trim()))
    );
    results.push(...batchResults);
  }

  return results;
}

async function downloadAll(urls) {
  const progressDiv = document.getElementById('progress');
  const downloadBtn = document.getElementById('downloadAll');
  const batchSizeSelect = document.getElementById('batchSize');

  // Configuration
  const CONCURRENT_DOWNLOADS = 10;
  const IMAGES_PER_ZIP = parseInt(batchSizeSelect?.value || 500);

  // Disable button and show progress
  downloadBtn.disabled = true;
  progressDiv.style.display = 'block';
  progressDiv.style.color = '#007bff';

  const totalImages = urls.length;
  const numZipFiles = Math.ceil(totalImages / IMAGES_PER_ZIP);

  progressDiv.textContent = `Preparing to download ${totalImages} images...`;

  let totalSuccess = 0;
  let totalFailed = 0;

  // Process in chunks to create multiple zip files if needed
  for (let zipIndex = 0; zipIndex < numZipFiles; zipIndex++) {
    const startIdx = zipIndex * IMAGES_PER_ZIP;
    const endIdx = Math.min(startIdx + IMAGES_PER_ZIP, totalImages);
    const chunkUrls = urls.slice(startIdx, endIdx);

    progressDiv.textContent = `Downloading batch ${zipIndex + 1}/${numZipFiles} (${startIdx + 1}-${endIdx} of ${totalImages})...`;

    // Download images concurrently
    const results = [];
    for (let i = 0; i < chunkUrls.length; i += CONCURRENT_DOWNLOADS) {
      const batch = chunkUrls.slice(i, i + CONCURRENT_DOWNLOADS);
      const batchResults = await Promise.all(
        batch.map(url => downloadImage(url.trim()))
      );
      results.push(...batchResults);

      // Update progress
      const completed = startIdx + i + batch.length;
      const percentage = Math.round((completed / totalImages) * 100);
      progressDiv.textContent = `Downloaded ${completed}/${totalImages} (${percentage}%) - Batch ${zipIndex + 1}/${numZipFiles}`;
    }

    // Count successes and failures
    const successResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    totalSuccess += successResults.length;
    totalFailed += failedResults.length;

    if (successResults.length === 0) {
      progressDiv.textContent = `Batch ${zipIndex + 1} failed completely. Skipping...`;
      progressDiv.style.color = 'orange';
      continue;
    }

    // Create zip file for this batch
    progressDiv.textContent = `Creating zip file ${zipIndex + 1}/${numZipFiles}...`;
    const zip = new JSZip();
    const folder = zip.folder('images');

    successResults.forEach((result, idx) => {
      folder.file(result.filename, result.blob);
    });

    const content = await zip.generateAsync({
      type: 'blob',
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });

    // Save the zip file
    const zipFilename = numZipFiles > 1
      ? `images_part${zipIndex + 1}_of_${numZipFiles}.zip`
      : 'images.zip';
    saveAs(content, zipFilename);

    progressDiv.textContent = `Saved ${zipFilename} (${successResults.length} images)`;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Final summary
  if (totalFailed > 0) {
    progressDiv.textContent = `Complete! ${totalSuccess} downloaded, ${totalFailed} failed. Check console for details.`;
    progressDiv.style.color = 'orange';
  } else {
    progressDiv.textContent = `Success! All ${totalSuccess} images downloaded in ${numZipFiles} zip file${numZipFiles > 1 ? 's' : ''}.`;
    progressDiv.style.color = 'green';
  }

  downloadBtn.disabled = false;
}

document.getElementById('loadBtn').addEventListener('click', () => {
  const sheetUrl = document.getElementById('sheetUrl').value;
  loadImages(sheetUrl);
});
