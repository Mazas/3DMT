// DOM refs
const urlInput = /** @type {HTMLInputElement} */ (
  document.getElementById('url-input')
);
const transformBtn = document.getElementById('transform-btn');
const viewerBefore = document.getElementById('viewer-before');
const viewerAfter = document.getElementById('viewer-after');
const sizeBefore = document.getElementById('size-before');
const sizeAfter = document.getElementById('size-after');
const spinnerOverlay = document.getElementById('spinner-overlay');
const modal = document.getElementById('modal');
const modalMsg = document.getElementById('modal-msg');
const modalClose = document.getElementById('modal-close');
const cfgFormat = /** @type {HTMLSelectElement} */ (
  document.getElementById('cfg-format')
);
const cfgResolution = /** @type {HTMLSelectElement} */ (
  document.getElementById('cfg-resolution')
);
const cfgSimplify = /** @type {HTMLInputElement} */ (
  document.getElementById('cfg-simplify')
);
const cfgRatio = /** @type {HTMLInputElement} */ (
  document.getElementById('cfg-ratio')
);
const ratioValue = document.getElementById('ratio-value');
const ratioWrap = document.getElementById('ratio-wrap');
const cfgKeepmaterials = /** @type {HTMLInputElement} */ (
  document.getElementById('cfg-keepmaterials')
);
const cfgKeepmeshes = /** @type {HTMLInputElement} */ (
  document.getElementById('cfg-keepmeshes')
);

// ---------------------------------------------------------------------------
// Config panel: toggle ratio slider visibility
// ---------------------------------------------------------------------------
cfgSimplify.addEventListener('change', () => {
  ratioWrap.classList.toggle('hidden', !cfgSimplify.checked);
});
ratioWrap.classList.add('hidden'); // hidden by default

cfgRatio.addEventListener('input', () => {
  ratioValue.textContent = cfgRatio.value;
});

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
function showModal(message) {
  modalMsg.textContent = message;
  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
}

modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format bytes as "1.23 MB" or "456 KB" */
function formatBytes(bytes) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(2)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

/** Get the byte size of a remote URL.
 *  Tries HEAD first (cheap), falls back to a full GET if no Content-Length. */
async function fetchRemoteSize(url) {
  try {
    const head = await fetch(url, { method: 'HEAD' });
    const cl = head.headers.get('Content-Length');
    if (cl) return parseInt(cl, 10);
  } catch {
    // ignore, try GET below
  }
  const resp = await fetch(url);
  const blob = await resp.blob();
  return blob.size;
}

/** Build the Config object from current UI state */
function readConfig() {
  const config = {};
  if (cfgFormat.value) config.format = cfgFormat.value;
  if (cfgResolution.value)
    config.resolution = parseInt(cfgResolution.value, 10);
  if (cfgSimplify.checked) {
    config.simplify = true;
    config.ratio = parseFloat(cfgRatio.value);
  }
  if (cfgKeepmaterials.checked) config.keepmaterials = true;
  if (cfgKeepmeshes.checked) config.keepmeshes = true;
  return config;
}

// ---------------------------------------------------------------------------
// Revoke any previously created object URL to avoid memory leaks
// ---------------------------------------------------------------------------
let lastObjectURL = null;

function setAfterSrc(blob) {
  if (lastObjectURL) URL.revokeObjectURL(lastObjectURL);
  lastObjectURL = URL.createObjectURL(blob);
  viewerAfter.setAttribute('src', lastObjectURL);
}

// ---------------------------------------------------------------------------
// Main transform flow
// ---------------------------------------------------------------------------
transformBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url) {
    showModal('Please enter a GLB URL.');
    return;
  }

  // Reset state
  sizeBefore.textContent = '';
  sizeAfter.textContent = '';
  viewerAfter.removeAttribute('src');
  spinnerOverlay.classList.remove('hidden');
  transformBtn.disabled = true;

  try {
    // Load original into left viewer
    viewerBefore.setAttribute('src', url);

    // Fetch original size in parallel with the transform POST
    const [originalSize, transformResponse] = await Promise.all([
      fetchRemoteSize(url).catch(() => null),
      fetch('/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, config: readConfig() }),
      }),
    ]);

    if (!transformResponse.ok) {
      const errBody = await transformResponse
        .json()
        .catch(() => ({ error: 'Unknown error' }));
      throw new Error(
        errBody.error ?? `Server error ${transformResponse.status}`,
      );
    }

    const transformedBlob = await transformResponse.blob();

    // Update viewers and size labels
    setAfterSrc(transformedBlob);

    if (originalSize !== null) {
      sizeBefore.textContent = formatBytes(originalSize);
    }

    const transformedSize = transformedBlob.size;
    let sizeLabel = formatBytes(transformedSize);
    if (originalSize) {
      const delta = Math.round((1 - transformedSize / originalSize) * 100);
      if (delta > 0) sizeLabel += ` (−${delta}%)`;
      else if (delta < 0) sizeLabel += ` (+${Math.abs(delta)}%)`;
    }
    sizeAfter.textContent = sizeLabel;
  } catch (err) {
    showModal(err instanceof Error ? err.message : String(err));
  } finally {
    spinnerOverlay.classList.add('hidden');
    transformBtn.disabled = false;
  }
});
