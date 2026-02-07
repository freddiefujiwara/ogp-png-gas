# OGP Generator

This is a Google Apps Script that generates OGP images from a Google Slides template.

## How to Use

Send a GET request to the Web App URL with a `t` parameter for the title.

**Example:**
`https://script.google.com/macros/s/.../exec?t=Your+Title+Here`

### CLI Usage
You can generate and save the PNG image directly from your terminal using `curl` and `jq`:

```bash
JSON_RESPONSE=$(curl -L -s "https://script.google.com/macros/s/AKfycbzbMAKxkzHlwN8SY7ygJA34xYESMNNdkGNt8vv1XMcZSksgHsUwOxCCdP-wgg6fv7M/exec?t=Your+Text")
echo $JSON_RESPONSE | jq -r '.png' | base64 -d > ogp.png
```

### Web Tool
You can also use the web-based tool:
[https://freddiefujiwara.com/ogp-png/](https://freddiefujiwara.com/ogp-png/)

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

## API Specification

OpenAPI definition is available at `openapi.yaml` in the repository root.

## Development

### Setup
```bash
npm install
```

### Running Tests
```bash
npm test
```

### Building
The project uses a build script to transform the source files into GAS-compatible files in the `dist/` directory.
```bash
npm run build
```

## Deployment

1. Install [clasp](https://github.com/google/clasp) globally:
   ```bash
   npm install -g @google/clasp
   ```
2. Login to your Google account:
   ```bash
   clasp login
   ```
3. Push the code to your GAS project:
   ```bash
   npm run deploy
   ```
