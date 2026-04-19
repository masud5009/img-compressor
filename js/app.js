'use strict';
// DOM Elements
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

// Main elements
const dropArea = $('#dropArea');
const fileInput = $('#fileInput');
const batchDropArea = $('#batchDropArea');
const batchFileInput = $('#batchFileInput');
const batchFolderInput = $('#batchFolderInput');
const result = $('#result');
const downloadAllBtn = $('#downloadAllBtn');
const clearBtn = $('#clearBtn');
const summary = $('#summary');
const statusText = $('#statusText');
const statusIcon = $('.status-icon');
const batchSelectionInfo = $('#batchSelectionInfo');
const processBatchBtn = $('#processBatchBtn');
const cancelBatchBtn = $('#cancelBatchBtn');
const outputPrefixInput = $('#outputPrefix');
const preserveStructureCheck = $('#preserveStructure');

// Settings elements
const presetSelect = $('#preset');
const qualitySlider = $('#quality');
const qualityValue = $('#qualityValue');
const formatSelect = $('#format');
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
let batchQueue = [];
let isAspectRatioLocked = true;
let originalAspectRatio = null;
let isProcessing = false;
let isBatchProcessing = false;
let batchCancelRequested = false;
const LOSSY_OUTPUT_FORMATS = new Set(['image/jpeg', 'image/webp']);
const CANVAS_OUTPUT_FORMATS = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Initialize
initEventListeners();
updateStatus('Ready', 'muted');
updateBatchSelectionUI();

// Functions
function initEventListeners() {
    // Drag and drop
    bindDropArea(dropArea, handleFiles);
    bindDropArea(batchDropArea, handleBatchSelection);

    // File input
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
    batchFileInput.addEventListener('change', (e) => handleBatchSelection(e.target.files));
    batchFolderInput.addEventListener('change', (e) => handleBatchSelection(e.target.files));

    // Settings controls
    qualitySlider.addEventListener('input', () => {
        qualityValue.textContent = qualitySlider.value;
        presetSelect.value = 'custom';
    });

    formatSelect.addEventListener('change', () => {
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
    processBatchBtn.addEventListener('click', processBatchQueue);
    cancelBatchBtn.addEventListener('click', cancelBatchProcess);

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

function bindDropArea(area, onDrop) {
    if (!area) return;

    area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.classList.add('drag');
    });

    area.addEventListener('dragleave', () => {
        area.classList.remove('drag');
    });

    area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('drag');
        onDrop(e.dataTransfer.files);
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
    if (isProcessing) {
        showFlashMessage('Wait for the current processing task to finish first.', 'warning');
        return;
    }

    const entries = createImageEntries(fileList);
    fileInput.value = '';

    if (!entries.length) return;

    const { processedCount, failedCount } = await processEntries(entries, {
        statusPrefix: 'Processing'
    });

    if (processedCount) {
        showFlashMessage(`${processedCount} image${processedCount === 1 ? '' : 's'} processed.`, failedCount ? 'warning' : 'success');
    } else if (failedCount) {
        showFlashMessage('Selected files could not be processed.', 'error');
    }
}

function handleBatchSelection(fileList) {
    if (isProcessing) {
        resetBatchInputs();
        showFlashMessage('Wait for the current processing task to finish first.', 'warning');
        return;
    }

    batchQueue = createImageEntries(fileList);
    resetBatchInputs();
    updateBatchSelectionUI();

    if (!batchQueue.length) {
        updateStatus('No valid images selected for batch', 'danger');
        return;
    }

    updateStatus(`${batchQueue.length} batch file${batchQueue.length === 1 ? '' : 's'} ready`, 'muted');
    showFlashMessage(`${batchQueue.length} file${batchQueue.length === 1 ? '' : 's'} queued for batch processing.`, 'success');
}

async function processBatchQueue() {
    if (!batchQueue.length || isProcessing) return;

    const selectedCount = batchQueue.length;
    const batchOptions = {
        prefix: outputPrefixInput.value,
        preserveStructure: preserveStructureCheck.checked
    };

    batchCancelRequested = false;
    isBatchProcessing = true;
    updateBatchSelectionUI();

    const batchResult = await processEntries(batchQueue, {
        statusPrefix: 'Batch processing',
        allowCancel: true,
        buildItemOptions: (entry) => ({
            batchOptions: {
                prefix: batchOptions.prefix,
                preserveStructure: batchOptions.preserveStructure,
                relativePath: entry.relativePath
            }
        })
    });

    isBatchProcessing = false;
    batchCancelRequested = false;
    batchQueue = [];
    updateBatchSelectionUI();

    if (batchResult.cancelled) {
        showFlashMessage(
            `Batch cancelled after ${batchResult.processedCount} of ${selectedCount} file${selectedCount === 1 ? '' : 's'}.`,
            'warning'
        );
        return;
    }

    if (batchResult.processedCount) {
        showFlashMessage(
            `Batch processed ${batchResult.processedCount} file${batchResult.processedCount === 1 ? '' : 's'}.`,
            batchResult.failedCount ? 'warning' : 'success'
        );
    } else if (batchResult.failedCount) {
        showFlashMessage('Selected batch files could not be processed.', 'error');
    }
}

function cancelBatchProcess() {
    if (isBatchProcessing) {
        batchCancelRequested = true;
        updateBatchSelectionUI();
        updateStatus('Stopping batch after the current file...', 'warning');
        return;
    }

    if (!batchQueue.length) return;

    batchQueue = [];
    resetBatchInputs();
    updateBatchSelectionUI();
    updateStatus('Batch selection cleared', 'muted');
    showFlashMessage('Batch selection cleared.', 'warning');
}

async function processEntries(entries, options = {}) {
    const {
        statusPrefix = 'Processing',
        allowCancel = false,
        buildItemOptions = () => undefined
    } = options;

    let processedCount = 0;
    let failedCount = 0;
    let cancelled = false;

    isProcessing = true;
    clearBtn.disabled = true;
    updateBatchSelectionUI();

    try {
        for (let index = 0; index < entries.length; index++) {
            if (allowCancel && batchCancelRequested) {
                cancelled = true;
                break;
            }

            const entry = entries[index];
            updateStatus(`${statusPrefix} ${index + 1}/${entries.length}...`, 'active');

            try {
                const processed = await processImage(entry.file);
                addImageToGrid(entry.file, processed, buildItemOptions(entry));
                processedCount += 1;
            } catch (error) {
                failedCount += 1;
                console.error(`Error processing ${entry.file.name}:`, error);
            }
        }
    } finally {
        isProcessing = false;
        updateSummary();
        downloadAllBtn.disabled = items.length === 0;
        clearBtn.disabled = items.length === 0;

        if (cancelled) {
            updateStatus(`Batch cancelled (${processedCount}/${entries.length})`, 'warning');
        } else if (failedCount && processedCount) {
            updateStatus('Completed with some skipped files', 'warning');
        } else if (failedCount) {
            updateStatus('No files were processed', 'danger');
        } else {
            updateStatus('Ready', 'success');
        }

        updateBatchSelectionUI();
    }

    return { processedCount, failedCount, cancelled };
}

function createImageEntries(fileList) {
    return Array.from(fileList || [])
        .filter(file => file.type && file.type.startsWith('image/'))
        .map(file => ({
            file,
            relativePath: normalizeRelativePath(file.webkitRelativePath || file.name)
        }));
}

function resetBatchInputs() {
    batchFileInput.value = '';
    batchFolderInput.value = '';
}

function updateBatchSelectionUI() {
    const count = batchQueue.length;
    const noun = count === 1 ? 'file' : 'files';

    if (!count) {
        batchSelectionInfo.textContent = isBatchProcessing
            ? 'Finishing the current batch task...'
            : 'No batch files selected.';
    } else if (isBatchProcessing) {
        batchSelectionInfo.textContent = batchCancelRequested
            ? `Cancelling batch. ${count} selected ${noun} will stop after the current image.`
            : `Processing ${count} selected ${noun} with the current settings.`;
    } else {
        batchSelectionInfo.textContent = `${count} ${noun} selected for the next batch run.`;
    }

    processBatchBtn.textContent = `Process ${count} File${count === 1 ? '' : 's'}`;
    processBatchBtn.disabled = count === 0 || isProcessing;
    cancelBatchBtn.textContent = isBatchProcessing ? 'Cancel Batch' : 'Clear Selection';
    cancelBatchBtn.disabled = count === 0 && !isBatchProcessing;
}

async function processImage(file) {
    // Read image dimensions and set aspect ratio
    const img = await loadImage(file);
    originalAspectRatio = img.width / img.height;

    // Get current settings
    const quality = parseInt(qualitySlider.value, 10) / 100;
    const keepOriginalFormat = formatSelect.value === 'keep';
    const format = keepOriginalFormat ? file.type : formatSelect.value;

    if (!CANVAS_OUTPUT_FORMATS.has(format)) {
        throw new Error(`Unsupported output format: ${format || 'unknown'}`);
    }

    // Resize settings
    let targetWidth, targetHeight;
    if (enableResizeCheck.checked) {
        if (resizeMethodSelect.value === 'percentage') {
            const scale = parseInt(resizePercentSlider.value, 10) / 100;
            targetWidth = Math.round(img.width * scale);
            targetHeight = Math.round(img.height * scale);
        } else {
            targetWidth = resizeWidthInput.value ? parseInt(resizeWidthInput.value, 10) : null;
            targetHeight = resizeHeightInput.value ? parseInt(resizeHeightInput.value, 10) : null;

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

    const dimensionsChanged = targetWidth !== img.width || targetHeight !== img.height;

    // Canvas export already strips EXIF metadata, so avoid a second re-encode
    // that can make JPEG/WEBP outputs larger than the original file.
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const outputBlob = await exportCanvasWithAdaptiveCompression(
        canvas,
        format,
        quality,
        keepOriginalFormat ? file.size : 0,
        keepOriginalFormat
    );

    const finalBlob = keepOriginalFormat && !dimensionsChanged && outputBlob.size >= file.size
        ? file
        : outputBlob;
    const finalFormat = finalBlob.type || format;
    const url = URL.createObjectURL(finalBlob);

    return {
        blob: finalBlob,
        url,
        format: finalFormat,
        width: targetWidth,
        height: targetHeight,
        originalWidth: img.width,
        originalHeight: img.height
    };
}

function exportCanvasBlob(canvas, format, quality) {
    return new Promise((resolve, reject) => {
        const exportQuality = LOSSY_OUTPUT_FORMATS.has(format) ? quality : undefined;

        canvas.toBlob(blob => {
            if (!blob) {
                reject(new Error(`Failed to export image as ${format}`));
                return;
            }

            resolve(blob);
        }, format, exportQuality);
    });
}

async function exportCanvasWithAdaptiveCompression(canvas, format, quality, originalSize, keepOriginalFormat) {
    let bestBlob = await exportCanvasBlob(canvas, format, quality);

    if (!keepOriginalFormat || !LOSSY_OUTPUT_FORMATS.has(format) || bestBlob.size < originalSize) {
        return bestBlob;
    }

    for (let nextQuality = quality - 0.05; nextQuality >= 0.1; nextQuality -= 0.05) {
        const candidateBlob = await exportCanvasBlob(canvas, format, Number(nextQuality.toFixed(2)));

        if (candidateBlob.size < bestBlob.size) {
            bestBlob = candidateBlob;
        }

        if (candidateBlob.size < originalSize) {
            return candidateBlob;
        }
    }

    return bestBlob;
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

function addImageToGrid(file, processed, options = {}) {
    const originalUrl = URL.createObjectURL(file);
    const batchOptions = options.batchOptions || null;
    const sourcePath = batchOptions && batchOptions.relativePath !== file.name
        ? normalizeRelativePath(batchOptions.relativePath)
        : '';
    const itemEl = document.createElement('div');
    itemEl.className = 'item';
    itemEl.innerHTML = `
        <div class="preview-container">
          <div class="preview-comparison">
            <div class="preview-original">
              <img class="preview-img" src="${originalUrl}" alt="Original">
            </div>
            <div class="preview-compressed">
              <img class="preview-img" src="${processed.url}" alt="Compressed">
            </div>
            <div class="comparison-handle"></div>
          </div>
          <div class="progress">
            <div class="progress-bar" style="width: ${getProgressWidth(file.size, processed.blob.size)}"></div>
          </div>
        </div>
        <div class="meta">
          <div class="meta-row">
            <span class="meta-label">Name:</span>
            <span class="meta-value">${escapeHtml(file.name)}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Size:</span>
            <span class="meta-value">${escapeHtml(formatSizeComparison(file.size, processed.blob.size))}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Dimensions:</span>
            <span class="meta-value">${processed.originalWidth}×${processed.originalHeight} → ${processed.width}×${processed.height}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Format:</span>
            <span class="meta-value">${file.type} → ${processed.format}</span>
          </div>
          ${sourcePath ? `
          <div class="meta-row">
            <span class="meta-label">Source:</span>
            <span class="meta-value">${escapeHtml(sourcePath)}</span>
          </div>
          ` : ''}
        </div>
        <div class="actions">
          <a href="${processed.url}" class="btn btn-sm download-link">
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

    const item = { file, processed, el: itemEl, batchOptions, originalUrl };
    $('.download-link', itemEl).download = getItemDownloadName(item);

    // Add event listeners
    $('.recompress', itemEl).addEventListener('click', () => recompressImage(file, itemEl));
    $('.remove', itemEl).addEventListener('click', () => removeImage(itemEl));

    result.prepend(itemEl);
    items.push(item);
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
        $('.download-link', itemEl).href = processed.url;
        $('.download-link', itemEl).download = getItemDownloadName(item);
        $('.progress-bar', itemEl).style.width = getProgressWidth(file.size, processed.blob.size);

        $('.meta-row:nth-child(2) .meta-value', itemEl).textContent =
            formatSizeComparison(file.size, processed.blob.size);

        $('.meta-row:nth-child(3) .meta-value', itemEl).textContent =
            `${processed.originalWidth}×${processed.originalHeight} → ${processed.width}×${processed.height}`;

        $('.meta-row:nth-child(4) .meta-value', itemEl).textContent =
            `${file.type} → ${processed.format}`;

        updateSummary();
        showFlashMessage(`Recompressed: ${toDisplayFormat(file.type)} → ${toDisplayFormat(processed.format)}`,"success");

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
    URL.revokeObjectURL(item.originalUrl);
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
        const usedPaths = new Set();

        // Add each image to the zip
        for (const item of items) {
            const filename = getUniqueArchivePath(getItemArchivePath(item), usedPaths);
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
    if (!items.length && !batchQueue.length) return;

    // Free memory by revoking object URLs
    items.forEach(item => {
        URL.revokeObjectURL(item.processed.url);
        URL.revokeObjectURL(item.originalUrl);
    });

    // Clear the UI
    items = [];
    result.innerHTML = '';

    // Update UI state
    downloadAllBtn.disabled = true;
    clearBtn.disabled = true;
    batchQueue = [];
    batchCancelRequested = false;
    isBatchProcessing = false;
    resetBatchInputs();
    updateBatchSelectionUI();
    updateSummary();
    showFlashMessage("All items and queued batch files have been cleared successfully!", "success");
}

function updateSummary() {
    const count = items.length;
    if (count === 0) {
        summary.textContent = '0 images processed';
        return;
    }

    const originalSize = items.reduce((sum, item) => sum + item.file.size, 0);
    const compressedSize = items.reduce((sum, item) => sum + item.processed.blob.size, 0);

    summary.textContent = getSummaryText(count, originalSize, compressedSize);
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
    } else if (type === 'warning') {
        statusIcon.style.background = 'var(--warning)';
    } else if (type === 'success') {
        statusIcon.style.background = 'var(--success)';
    } else {
        statusIcon.style.background = 'var(--muted)';
    }
}

function getSizeChangePercent(originalSize, compressedSize) {
    return (1 - compressedSize / originalSize) * 100;
}

function formatSizeComparison(originalSize, compressedSize, precision = 0) {
    const change = getSizeChangePercent(originalSize, compressedSize);
    const label = change >= 0 ? 'saved' : 'larger';
    return `${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${Math.abs(change).toFixed(precision)}% ${label})`;
}

function getProgressWidth(originalSize, compressedSize) {
    return `${Math.max(0, getSizeChangePercent(originalSize, compressedSize)).toFixed(0)}%`;
}

function getSummaryText(count, originalSize, compressedSize) {
    const change = getSizeChangePercent(originalSize, compressedSize);
    const label = change >= 0 ? 'saved' : 'larger';
    return `${count} images • ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${Math.abs(change).toFixed(1)}% ${label})`;
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

function getDownloadFilename(file, outputFormat) {
    return getOutputFilename(file.name, outputFormat, file.type);
}

function getItemDownloadName(item) {
    return applyFilenamePrefix(
        getOutputFilename(item.file.name, item.processed.format, item.file.type),
        item.batchOptions?.prefix
    );
}

function getItemArchivePath(item) {
    const filename = getItemDownloadName(item);

    if (!item.batchOptions?.preserveStructure) {
        return filename;
    }

    const directory = getRelativeDirectory(item.batchOptions.relativePath);
    return directory ? `${directory}/${filename}` : filename;
}

function applyFilenamePrefix(filename, prefix = '') {
    const safePrefix = sanitizeFilenamePrefix(prefix);
    return safePrefix ? `${safePrefix}${filename}` : filename;
}

function sanitizeFilenamePrefix(prefix = '') {
    return String(prefix).replace(/[\\/:*?"<>|]+/g, '_');
}

function getRelativeDirectory(relativePath = '') {
    const normalized = normalizeRelativePath(relativePath);
    const slashIndex = normalized.lastIndexOf('/');
    return slashIndex === -1 ? '' : normalized.slice(0, slashIndex);
}

function normalizeRelativePath(relativePath = '') {
    return String(relativePath)
        .replace(/\\/g, '/')
        .replace(/^\/+|\/+$/g, '');
}

function getUniqueArchivePath(path, usedPaths) {
    let candidate = path;
    let counter = 1;
    const dotIndex = path.lastIndexOf('.');
    const base = dotIndex === -1 ? path : path.slice(0, dotIndex);
    const extension = dotIndex === -1 ? '' : path.slice(dotIndex);

    while (usedPaths.has(candidate)) {
        candidate = `${base} (${counter})${extension}`;
        counter += 1;
    }

    usedPaths.add(candidate);
    return candidate;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toDisplayFormat(mimeType) {
    return mimeType ? mimeType.toUpperCase() : 'UNKNOWN';
}

function getOutputFilename(originalName, outputFormat, originalFormat = null) {
    if (originalFormat && outputFormat === originalFormat) {
        return originalName;
    }

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
