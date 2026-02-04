import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Code from '../src/Code.js';

describe('Code.js', () => {
  const mockFile = {
    makeCopy: vi.fn().mockReturnThis(),
    getId: vi.fn().mockReturnValue('mock-temp-id'),
    setTrashed: vi.fn(),
  };

  const mockSlide = {
    replaceAllText: vi.fn(),
  };

  const mockPresentation = {
    getSlides: vi.fn().mockReturnValue([mockSlide]),
    saveAndClose: vi.fn(),
  };

  const mockBlob = {
    setName: vi.fn().mockReturnThis(),
    getBytes: vi.fn().mockReturnValue([1, 2, 3]),
  };

  const mockResponse = {
    getBlob: vi.fn().mockReturnValue(mockBlob),
  };

  const mockOutput = {
    setMimeType: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.stubGlobal('DriveApp', {
      getFileById: vi.fn().mockReturnValue(mockFile),
    });

    vi.stubGlobal('SlidesApp', {
      openById: vi.fn().mockReturnValue(mockPresentation),
    });

    vi.stubGlobal('ScriptApp', {
      getOAuthToken: vi.fn().mockReturnValue('mock-token'),
    });

    vi.stubGlobal('UrlFetchApp', {
      fetch: vi.fn().mockReturnValue(mockResponse),
    });

    vi.stubGlobal('Utilities', {
      base64Encode: vi.fn().mockReturnValue('mock-base64'),
    });

    vi.stubGlobal('ContentService', {
      createTextOutput: vi.fn().mockReturnValue(mockOutput),
      MimeType: {
        TEXT: 'TEXT_MIME_TYPE',
      },
    });
  });

  describe('doGet', () => {
    it('should use provided title and return base64 encoded image', () => {
      const e = {
        parameter: {
          t: 'Test Title'
        }
      };

      const result = Code.doGet(e);

      expect(DriveApp.getFileById).toHaveBeenCalledWith('19WVKprEJMvo0IRMY2oDEiv0yTnJRq17JpHuDSTAm-ww');
      expect(mockFile.makeCopy).toHaveBeenCalledWith('temp_ogp');
      expect(SlidesApp.openById).toHaveBeenCalledWith('mock-temp-id');
      expect(mockSlide.replaceAllText).toHaveBeenCalledWith('{{title}}', 'Test Title');
      expect(mockPresentation.saveAndClose).toHaveBeenCalled();

      const expectedUrl = 'https://docs.google.com/presentation/d/mock-temp-id/export/png';
      expect(UrlFetchApp.fetch).toHaveBeenCalledWith(expectedUrl, {
        headers: { Authorization: 'Bearer mock-token' }
      });

      expect(mockFile.setTrashed).toHaveBeenCalledWith(true);
      expect(Utilities.base64Encode).toHaveBeenCalledWith([1, 2, 3]);
      expect(ContentService.createTextOutput).toHaveBeenCalledWith('mock-base64');
      expect(mockOutput.setMimeType).toHaveBeenCalledWith('TEXT_MIME_TYPE');
      expect(result).toBe(mockOutput);
    });

    it('should use default title when none provided', () => {
      const e = {
        parameter: {}
      };

      Code.doGet(e);

      expect(mockSlide.replaceAllText).toHaveBeenCalledWith('{{title}}', 'No Title');
    });
  });
});
