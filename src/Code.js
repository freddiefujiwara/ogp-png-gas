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
    const base64Image = generateOgpImage(title);
    const output = JSON.stringify({ png: base64Image });
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

/**
 * Generates an OGP image from a Google Slides template.
 *
 * @param {string} title - The title to replace in the template
 * @returns {string} Base64 encoded PNG image
 */
function generateOgpImage(title) {
  const templateFile = DriveApp.getFileById(CONFIG.TEMPLATE_ID);
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
    const blob = response.getBlob().setName(CONFIG.OUTPUT_FILE_NAME);

    return Utilities.base64Encode(blob.getBytes());
  } finally {
    // Ensure the temporary file is deleted even if an error occurs
    tempFile.setTrashed(true);
  }
}

/**
 * Calculates the weighted length of a string.
 * Half-width characters (ASCII and half-width Katakana) are weighted as 1.0.
 * Full-width characters are weighted as 1.65.
 * @param {string} str
 * @returns {number}
 */
export function getWeightedLength(str) {
  if (!str) return 0;
  let length = 0;
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    // ASCII: 0x0000 to 0x007F
    // Half-width Katakana: 0xFF61 to 0xFF9F
    if ((charCode >= 0x0000 && charCode <= 0x007F) || (charCode >= 0xFF61 && charCode <= 0xFF9F)) {
      length += 1;
    } else {
      length += 1.65;
    }
  }
  return length;
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
