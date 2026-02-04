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
  const title = (e && e.parameter && e.parameter.t) || "No Title";

  try {
    const base64Image = generateOgpImage(title);
    return ContentService.createTextOutput(base64Image)
      .setMimeType(ContentService.MimeType.TEXT);
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
