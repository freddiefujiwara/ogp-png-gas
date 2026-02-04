# OGP Generator

This is a Google Apps Script that generates OGP images from a Google Slides template.

## How to Use

Send a GET request to the Web App URL with a `t` parameter for the title.

**Example:**
`https://script.google.com/macros/s/.../exec?t=Your+Title+Here`

### Text Processing
- The title will be truncated if it is too long (maximum weighted length of 66).
- Full-width characters (like Japanese) count as 1.65.
- Half-width characters (like English letters) count as 1.0.
- Newlines in the title will be replaced with spaces.

## Response Format

The Web App returns a JSON object.

### Success
It returns the image as a base64 string.
```json
{
  "png": "iVBORw0KGgoAAAANSUhEUgAA..."
}
```

### Error
If something goes wrong, it returns an error message.
```json
{
  "error": "Failed to generate image",
  "details": "Error message here"
}
```
