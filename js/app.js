'use strict';
// DOM Elements
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

// Main elements
const dropArea = $('#dropArea');
const fileInput = $('#fileInput');
const result = $('#result');
const downloadAllBtn = $('#downloadAllBtn');
const clearBtn = $('#clearBtn');
const summary = $('#summary');
const statusText = $('#statusText');
const statusIcon = $('.status-icon');

// Settings elements
const presetSelect = $('#preset');
const qualitySlider = $('#quality');
const qualityValue = $('#qualityValue');
const formatSelect = $('#format');
const removeMetadataCheck = $('#removeMetadata');
const enableResizeCheck = $('#enableResize');
const resizeMethodSelect = $('#resizeMethod');
const resizePercentSlider = $('#resizePercent');
const percentValue = $('#percentValue');
const resizeWidthInput = $('#resizeWidth');
const resizeHeightInput = $('#resizeHeight');
const lockAspectBtn = $('#lockAspect');
const shrinkOnlyCheck = $('#shrinkOnly');
const presetButtons = $$('.preset-btn');

// Tab elements
const tabs = $$('.tab');
const tabContents = $$('.tab-content');

// State
let items = [];
let isAspectRatioLocked = true;
let originalAspectRatio = null;
let isProcessing = false;

// Initialize
initEventListeners();
updateStatus('Ready', 'muted');

// Functions
function initEventListeners() {
    // Drag and drop
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('drag');
    });

    dropArea.addEventListener('dragleave', () => {
        dropArea.classList.remove('drag');
    });

    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('drag');
        handleFiles(e.dataTransfer.files);
    });

    // File input
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    // Settings controls
    qualitySlider.addEventListener('input', () => {
        qualityValue.textContent = qualitySlider.value;
        presetSelect.value = 'custom';
    });

    presetSelect.addEventListener('change', applyPreset);
    presetButtons.forEach(btn => btn.addEventListener('click', applyQuickPreset));

    enableResizeCheck.addEventListener('change', () => {
        const isEnabled = enableResizeCheck.checked;
        resizeMethodSelect.disabled = !isEnabled;
        resizePercentSlider.disabled = !isEnabled;
        resizeWidthInput.disabled = !isEnabled;
        resizeHeightInput.disabled = !isEnabled;
        lockAspectBtn.disabled = !isEnabled;
        shrinkOnlyCheck.disabled = !isEnabled;
    });

    resizeMethodSelect.addEventListener('change', () => {
        const method = resizeMethodSelect.value;
        $('#percentageControl').style.display = method === 'percentage' ? 'block' : 'none';
        $('#dimensionsControl').style.display = method === 'dimensions' ? 'block' : 'none';
    });

    resizePercentSlider.addEventListener('input', () => {
        percentValue.textContent = resizePercentSlider.value;
    });

    [resizeWidthInput, resizeHeightInput].forEach(input => {
        input.addEventListener('input', handleDimensionChange);
    });

    lockAspectBtn.addEventListener('click', () => {
        isAspectRatioLocked = !isAspectRatioLocked;
        lockAspectBtn.classList.toggle('active', isAspectRatioLocked);
    });

    // Actions
    downloadAllBtn.addEventListener('click', downloadAllAsZip);
    clearBtn.addEventListener('click', clearAll);

    // Tabs
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            tabContents.forEach(content => content.classList.remove('active'));
            $(`#${tab.dataset.tab}-tab`).classList.add('active');
        });
    });
}

function applyPreset() {
    const preset = presetSelect.value;

    switch (preset) {
        case 'low':
            qualitySlider.value = 90;
            formatSelect.value = 'image/jpeg';
            break;
        case 'medium':
            qualitySlider.value = 80;
            formatSelect.value = 'image/webp';
            break;
        case 'high':
            qualitySlider.value = 65;
            formatSelect.value = 'image/webp';
            break;
        case 'extreme':
            qualitySlider.value = 40;
            formatSelect.value = 'image/jpeg';
            break;
    }

    qualityValue.textContent = qualitySlider.value;
}

function applyQuickPreset(e) {
    const preset = e.currentTarget.dataset.preset;

    // Reset all preset buttons
    presetButtons.forEach(btn => btn.classList.remove('active'));
    // Activate clicked button
    e.currentTarget.classList.add('active');

    switch (preset) {
        case 'social':
            qualitySlider.value = 80;
            formatSelect.value = 'image/jpeg';
            enableResizeCheck.checked = true;
            resizeMethodSelect.value = 'dimensions';
            resizeWidthInput.value = 1080;
            resizeHeightInput.value = '';
            break;
        case 'web':
            qualitySlider.value = 70;
            formatSelect.value = 'image/webp';
            enableResizeCheck.checked = true;
            resizeMethodSelect.value = 'dimensions';
            resizeWidthInput.value = 1200;
            resizeHeightInput.value = '';
            break;
        case 'print':
            qualitySlider.value = 100;
            formatSelect.value = 'image/png';
            enableResizeCheck.checked = false;
            break;
        case 'mobile':
            qualitySlider.value = 60;
            formatSelect.value = 'image/jpeg';
            enableResizeCheck.checked = true;
            resizeMethodSelect.value = 'dimensions';
            resizeWidthInput.value = 720;
            resizeHeightInput.value = '';
            break;
    }

    qualityValue.textContent = qualitySlider.value;
    presetSelect.value = 'custom';
}

function handleDimensionChange(e) {
    if (!isAspectRatioLocked || !originalAspectRatio) return;

    const changedInput = e.target;
    const otherInput = changedInput === resizeWidthInput ? resizeHeightInput : resizeWidthInput;

    if (changedInput.value && !otherInput.value) {
        // If one dimension is entered and the other is empty, calculate it
        if (changedInput === resizeWidthInput) {
            resizeHeightInput.value = Math.round(changedInput.value / originalAspectRatio);
        } else {
            resizeWidthInput.value = Math.round(changedInput.value * originalAspectRatio);
        }
    } else if (changedInput.value && otherInput.value) {
        // If both have values, adjust the other input to maintain aspect ratio
        if (changedInput === resizeWidthInput) {
            resizeHeightInput.value = Math.round(changedInput.value / originalAspectRatio);
        } else {
            resizeWidthInput.value = Math.round(changedInput.value * originalAspectRatio);
        }
    }
}

async function handleFiles(fileList) {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (!files.length) return;

    updateStatus('Processing...', 'active');
    isProcessing = true;
    clearBtn.disabled = true;

    try {
        for (const file of files) {
            const processed = await processImage(file);
            addImageToGrid(file, processed);
        }

        updateSummary();
        downloadAllBtn.disabled = false;
        clearBtn.disabled = false;
        updateStatus('Ready', 'success');
    } catch (error) {
        console.error('Error processing images:', error);
        updateStatus('Error processing files', 'danger');
    } finally {
        isProcessing = false;
    }
}

async function processImage(file) {
    return new Promise(async (resolve) => {
        // Read image dimensions and set aspect ratio
        const img = await loadImage(file);
        originalAspectRatio = img.width / img.height;

        // Get current settings
        const quality = parseInt(qualitySlider.value) / 100;
        const format = formatSelect.value === 'keep' ? file.type : formatSelect.value;
        const removeMetadata = removeMetadataCheck.checked;

        // Resize settings
        let targetWidth, targetHeight;
        if (enableResizeCheck.checked) {
            if (resizeMethodSelect.value === 'percentage') {
                const scale = parseInt(resizePercentSlider.value) / 100;
                targetWidth = Math.round(img.width * scale);
                targetHeight = Math.round(img.height * scale);
            } else {
                targetWidth = resizeWidthInput.value ? parseInt(resizeWidthInput.value) : null;
                targetHeight = resizeHeightInput.value ? parseInt(resizeHeightInput.value) : null;

                if (isAspectRatioLocked) {
                    if (targetWidth && !targetHeight) {
                        targetHeight = Math.round(targetWidth / originalAspectRatio);
                    } else if (targetHeight && !targetWidth) {
                        targetWidth = Math.round(targetHeight * originalAspectRatio);
                    }
                }
            }

            if (shrinkOnlyCheck.checked) {
                targetWidth = targetWidth ? Math.min(targetWidth, img.width) : img.width;
                targetHeight = targetHeight ? Math.min(targetHeight, img.height) : img.height;
            }
        } else {
            targetWidth = img.width;
            targetHeight = img.height;
        }

        // Create canvas and draw image
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Convert to blob with quality
        const blob = await new Promise(resolve => {
            canvas.toBlob(blob => resolve(blob), format, quality);
        });

        // Remove metadata if requested (simplified - in real app you'd use a proper EXIF library)
        let finalBlob = blob;
        if (removeMetadata && (format === 'image/jpeg' || format === 'image/webp')) {
            // In a real implementation, you would use exifr or similar to properly strip metadata
            finalBlob = await stripMetadata(blob);
        }

        const url = URL.createObjectURL(finalBlob);
        resolve({
            blob: finalBlob,
            url,
            format,
            width: targetWidth,
            height: targetHeight,
            originalWidth: img.width,
            originalHeight: img.height
        });
    });
}

// Simplified metadata stripping - in a real app you'd use exifr or similar
async function stripMetadata(blob) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(resolve, blob.type);
        };
        img.src = URL.createObjectURL(blob);
    });
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

function addImageToGrid(file, processed) {
    const itemEl = document.createElement('div');
    itemEl.className = 'item';
    itemEl.innerHTML = `
        <div class="preview-container">
          <div class="preview-comparison">
            <div class="preview-original">
              <img class="preview-img" src="${URL.createObjectURL(file)}" alt="Original">
            </div>
            <div class="preview-compressed">
              <img class="preview-img" src="${processed.url}" alt="Compressed">
            </div>
            <div class="comparison-handle"></div>
          </div>
          <div class="progress">
            <div class="progress-bar" style="width: ${((1 - processed.blob.size / file.size) * 100).toFixed(0)}%"></div>
          </div>
        </div>
        <div class="meta">
          <div class="meta-row">
            <span class="meta-label">Name:</span>
            <span class="meta-value">${file.name}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Size:</span>
            <span class="meta-value">${formatBytes(file.size)} → ${formatBytes(processed.blob.size)} (${((1 - processed.blob.size / file.size) * 100).toFixed(0)}% saved)</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Dimensions:</span>
            <span class="meta-value">${processed.originalWidth}×${processed.originalHeight} → ${processed.width}×${processed.height}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Format:</span>
            <span class="meta-value">${file.type} → ${processed.format}</span>
          </div>
        </div>
        <div class="actions">
          <a href="${processed.url}" download="${getOutputFilename(file.name, processed.format)}" class="btn btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download
          </a>
          <button class="btn btn-sm btn-outline recompress">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
              <path d="M16 16h5v5"></path>
            </svg>
            Recompress
          </button>
          <button class="btn btn-sm btn-outline remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18"></path>
              <path d="M6 6l12 12"></path>
            </svg>
            Remove
          </button>
        </div>
      `;

    // Setup comparison slider
    setupComparisonSlider(itemEl);

    // Add event listeners
    $('.recompress', itemEl).addEventListener('click', () => recompressImage(file, itemEl));
    $('.remove', itemEl).addEventListener('click', () => removeImage(itemEl));

    result.prepend(itemEl);
    items.push({ file, processed, el: itemEl });
}

function setupComparisonSlider(itemEl) {
    const container = $('.preview-comparison', itemEl);
    const handle = $('.comparison-handle', itemEl);
    const original = $('.preview-original', itemEl);

    let isDragging = false;

    handle.addEventListener('mousedown', (e) => {
        isDragging = true;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const rect = container.getBoundingClientRect();
        let x = e.clientX - rect.left;
        x = Math.max(0, Math.min(x, rect.width));

        const percent = (x / rect.width) * 100;
        original.style.width = `${percent}%`;
        handle.style.left = `${percent}%`;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

async function recompressImage(file, itemEl) {
    const item = items.find(item => item.el === itemEl);
    if (!item) return;

    $('.recompress', itemEl).disabled = true;
    updateStatus('Recompressing...', 'active');

    try {
        const processed = await processImage(file);

        // Update the item
        URL.revokeObjectURL(item.processed.url);
        item.processed = processed;

        // Update the UI
        $('.preview-compressed img', itemEl).src = processed.url;
        $('a[download]', itemEl).href = processed.url;
        $('a[download]', itemEl).download = getOutputFilename(file.name, processed.format);
        $('.progress-bar', itemEl).style.width = `${((1 - processed.blob.size / file.size) * 100).toFixed(0)}%`;

        $('.meta-row:nth-child(2) .meta-value', itemEl).textContent =
            `${formatBytes(file.size)} → ${formatBytes(processed.blob.size)} (${((1 - processed.blob.size / file.size) * 100).toFixed(0)}% saved)`;

        $('.meta-row:nth-child(3) .meta-value', itemEl).textContent =
            `${processed.originalWidth}×${processed.originalHeight} → ${processed.width}×${processed.height}`;

        $('.meta-row:nth-child(4) .meta-value', itemEl).textContent =
            `${file.type} → ${processed.format}`;

        updateSummary();
        showFlashMessage(`Recompressed: ${file.type.toUpperCase()} → ${processed.format.toUpperCase()}`,"success");

        updateStatus('Ready', 'success');
    } catch (error) {
        console.error('Error recompressing image:', error);
        updateStatus('Error recompressing', 'danger');
    } finally {
        $('.recompress', itemEl).disabled = false;
    }
}

function removeImage(itemEl) {
    const index = items.findIndex(item => item.el === itemEl);
    if (index === -1) return;

    const [item] = items.splice(index, 1);
    URL.revokeObjectURL(item.processed.url);
    itemEl.remove();

    updateSummary();
    showFlashMessage("Image removed successfully!", "warning");
    if (items.length === 0) {
        downloadAllBtn.disabled = true;
        clearBtn.disabled = true;
    }
}

async function downloadAllAsZip() {
    if (!items.length) return;

    downloadAllBtn.disabled = true;
    downloadAllBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Preparing ZIP...
      `;
    updateStatus('Creating ZIP archive...', 'active');

    try {
        const zip = new JSZip();

        // Add each image to the zip
        for (const item of items) {
            const ext = getFileExtension(item.processed.format);
            const filename = getOutputFilename(item.file.name, item.processed.format);
            zip.file(filename, item.processed.blob);
        }

        // Generate the zip file
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);

        // Create download link and trigger click
        const a = document.createElement('a');
        a.href = url;
        a.download = `compressed-images-${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(a);
        a.click();

        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        updateStatus('ZIP download complete', 'success');
    } catch (error) {
        console.error('Error creating ZIP:', error);
        updateStatus('Error creating ZIP', 'danger');
    } finally {
        downloadAllBtn.disabled = false;
        downloadAllBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Download All (.zip)
        `;
    }
}

function clearAll() {
    if (!items.length) return;

    // Free memory by revoking object URLs
    items.forEach(item => URL.revokeObjectURL(item.processed.url));

    // Clear the UI
    items = [];
    result.innerHTML = '';

    // Update UI state
    downloadAllBtn.disabled = true;
    clearBtn.disabled = true;
    updateSummary();
    showFlashMessage("All items have been cleared successfully!", "success");
}

function updateSummary() {
    const count = items.length;
    if (count === 0) {
        summary.textContent = '0 images processed';
        return;
    }

    const originalSize = items.reduce((sum, item) => sum + item.file.size, 0);
    const compressedSize = items.reduce((sum, item) => sum + item.processed.blob.size, 0);
    const savings = ((1 - compressedSize / originalSize) * 100).toFixed(1);

    summary.textContent = `${count} images • ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${savings}% saved)`;
}
// Flash message function
function showFlashMessage(message, type = "success") {
    const flash = document.createElement("div");
    flash.className = `flash-message ${type}`;
    flash.textContent = message;

    document.body.appendChild(flash);

    // Animate in
    setTimeout(() => {
        flash.classList.add("show");
    }, 50);

    // Remove after 3 seconds
    setTimeout(() => {
        flash.classList.remove("show");
        setTimeout(() => flash.remove(), 300);
    }, 6000);
}

function updateStatus(text, type) {
    statusText.textContent = text;
    statusIcon.className = 'status-icon';

    if (type === 'active') {
        statusIcon.classList.add('active');
    } else if (type === 'danger') {
        statusIcon.style.background = 'var(--danger)';
    } else if (type === 'success') {
        statusIcon.style.background = 'var(--success)';
    } else {
        statusIcon.style.background = 'var(--muted)';
    }
}

function formatBytes(bytes) {
    if (!bytes) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;

    while (bytes >= 1024 && i < units.length - 1) {
        bytes /= 1024;
        i++;
    }

    return `${bytes.toFixed(i ? 1 : 0)} ${units[i]}`;
}

function getFileExtension(mimeType) {
    return mimeType === 'image/jpeg' ? 'jpg' :
        mimeType === 'image/png' ? 'png' :
            mimeType === 'image/webp' ? 'webp' : 'jpg';
}

function getOutputFilename(originalName, outputFormat) {
    const ext = getFileExtension(outputFormat);
    return originalName.replace(/\.[^.]+$/, '') + '.' + ext;
}

/*block inspect*/
 // document.addEventListener('contextmenu', event => event.preventDefault()); // Right click off
 //    document.addEventListener('keydown', event => {
 //        if (event.ctrlKey && ['u', 's', 'c', 'v', 'x'].includes(event.key.toLowerCase())) {
 //            event.preventDefault();
 //        }
 //        if (event.keyCode == 123) { 
 //            event.preventDefault();
 //        }
 //    });