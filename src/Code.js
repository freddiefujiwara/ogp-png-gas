/**
 * Configuration for the OGP generation
 */
const CONFIG = {
  TEMPLATE_ID: "19WVKprEJMvo0IRMY2oDEiv0yTnJRq17JpHuDSTAm-ww",
  TEMP_FILE_NAME: "temp_ogp",
  OUTPUT_FILE_NAME: "ogp.png",
  PLACEHOLDER: "{{title}}"
};

/**
 * Handles GET requests to the Web App.
 * Returns the OGP image as a Base64 encoded string.
 *
 * @param {Object} e - Event object from GAS Web App
 * @returns {GoogleAppsScript.Content.TextOutput} Base64 encoded PNG or error message
 */
export function doGet(e) {
  let title = (e && e.parameter && e.parameter.t) || "No Title";

  // Process the title
  title = replaceNewlines(title);
  title = truncateToWeightedLength(title, 66);

  try {
    const templateFile = DriveApp.getFileById(CONFIG.TEMPLATE_ID);
    // Rendering is expensive (a Slides copy, an open and an export per
    // call) and this endpoint is anonymous, so repeat titles — the CI
    // callers ask for the same handful of app names on every run — are
    // served from a Drive cache next to the template instead.
    const cached = readCachedImage_(templateFile, title);
    if (cached) {
      return ContentService.createTextOutput(JSON.stringify({ png: cached }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const blob = generateOgpImage(templateFile, title);
    writeCachedImage_(templateFile, title, blob);
    const output = JSON.stringify({ png: Utilities.base64Encode(blob.getBytes()) });
    return ContentService.createTextOutput(output)
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error('Failed to generate OGP image:', error);
    return ContentService.createTextOutput(JSON.stringify({
      error: 'Failed to generate image',
      details: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

const titleCacheFileName_ = (title) => {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    title,
    Utilities.Charset.UTF_8
  );
  const hex = digest
    .map((b) => ('0' + (b & 0xff).toString(16)).slice(-2))
    .join('');
  return `ogp-cache-${hex}.png`;
};

// Both cache helpers are best-effort: any Drive hiccup falls back to a
// fresh render (read) or is simply skipped (write).
function readCachedImage_(templateFile, title) {
  try {
    const parents = templateFile.getParents();
    if (!parents.hasNext()) return null;
    const files = parents.next().getFilesByName(titleCacheFileName_(title));
    if (!files.hasNext()) return null;
    return Utilities.base64Encode(files.next().getBlob().getBytes());
  } catch (e) {
    return null;
  }
}

function writeCachedImage_(templateFile, title, blob) {
  try {
    const parents = templateFile.getParents();
    if (!parents.hasNext()) return;
    parents.next().createFile(blob.setName(titleCacheFileName_(title)));
  } catch (e) {
    /* cache is best-effort */
  }
}

/**
 * Generates an OGP image from a Google Slides template.
 *
 * @param {GoogleAppsScript.Drive.File} templateFile - The template file
 * @param {string} title - The title to replace in the template
 * @returns {GoogleAppsScript.Base.Blob} The PNG blob
 */
function generateOgpImage(templateFile, title) {
  const tempFile = templateFile.makeCopy(CONFIG.TEMP_FILE_NAME);
  const tempId = tempFile.getId();

  try {
    const presentation = SlidesApp.openById(tempId);
    const slide = presentation.getSlides()[0];

    // Replace placeholder with actual title
    slide.replaceAllText(CONFIG.PLACEHOLDER, title);
    presentation.saveAndClose();

    // Export the slide as PNG using the thumbnail export URL
    const url = `https://docs.google.com/presentation/d/${tempId}/export/png`;
    const options = {
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() }
    };
    const response = UrlFetchApp.fetch(url, options);
    return response.getBlob().setName(CONFIG.OUTPUT_FILE_NAME);
  } finally {
    // Ensure the temporary file is deleted even if an error occurs
    tempFile.setTrashed(true);
  }
}

/**
 * Truncates a string to stay within the maximum weighted length.
 * @param {string} str
 * @param {number} maxWeight
 * @returns {string}
 */
export function truncateToWeightedLength(str, maxWeight) {
  if (!str) return '';
  let currentWeight = 0;
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const charCode = char.charCodeAt(0);
    const weight = ((charCode >= 0x0000 && charCode <= 0x007F) || (charCode >= 0xFF61 && charCode <= 0xFF9F)) ? 1 : 1.65;

    if (currentWeight + weight <= maxWeight + 0.0001) { // Add small epsilon for floating point comparison
      result += char;
      currentWeight += weight;
    } else {
      break;
    }
  }
  return result;
}

/**
 * Replaces all occurrences of newlines with a single space.
 * @param {string} str
 * @returns {string}
 */
export function replaceNewlines(str) {
  if (!str) return '';
  return str.replace(/\r?\n/g, ' ');
}
