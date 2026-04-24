import logger from '../utils/logger.js';

class GoogleWorkspaceService {
  constructor() {
    this.driveUrl = 'https://www.googleapis.com/drive/v3';
    this.docsUrl = 'https://docs.googleapis.com/v1/documents';
    this.sheetsUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
    this.slidesUrl = 'https://slides.googleapis.com/v1/presentations';
  }

  async googleRequest(url, accessToken, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('Google API Request Error:', {
        url,
        status: response.status,
        error: errorData
      });
      const error = new Error(errorData?.error?.message || `Google API error: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    if (response.status === 204) return null;
    return await response.json();
  }

  // --- DRIVE ---
  async listFiles(accessToken, query = '', limit = 20) {
    const params = new URLSearchParams({
      pageSize: String(limit),
      fields: 'files(id, name, mimeType, webViewLink, modifiedTime)',
      orderBy: 'modifiedTime desc',
      q: query || "trashed = false"
    });
    const data = await this.googleRequest(`${this.driveUrl}/files?${params}`, accessToken);
    return data.files || [];
  }

  async getFileMetadata(accessToken, fileId) {
    const params = new URLSearchParams({
      fields: 'id, name, mimeType, description, webViewLink, owners, modifiedTime, size'
    });
    return await this.googleRequest(`${this.driveUrl}/files/${fileId}?${params}`, accessToken);
  }

  // --- DOCS ---
  async getDocumentContent(accessToken, documentId) {
    const doc = await this.googleRequest(`${this.docsUrl}/${documentId}`, accessToken);
    let fullText = '';
    
    const extractText = (content) => {
      content.forEach(el => {
        if (el.paragraph) {
          el.paragraph.elements.forEach(element => {
            if (element.textRun) {
              fullText += element.textRun.content;
            }
          });
        } else if (el.table) {
          el.table.tableRows.forEach(row => {
            row.tableCells.forEach(cell => {
              extractText(cell.content);
            });
          });
        } else if (el.sectionBreak) {
           // Skip
        } else if (el.tableOfContents) {
          extractText(el.tableOfContents.content);
        }
      });
    };

    if (doc.body?.content) {
      extractText(doc.body.content);
    }

    return {
      title: doc.title,
      content: fullText.trim(),
      documentId: doc.documentId
    };
  }

  // --- SHEETS ---
  async getSpreadsheetData(accessToken, spreadsheetId, range = 'A1:Z50') {
    const data = await this.googleRequest(`${this.sheetsUrl}/${spreadsheetId}/values/${range}`, accessToken);
    return {
      spreadsheetId,
      range: data.range,
      values: data.values || [] // Array of arrays
    };
  }

  // --- SLIDES ---
  async getPresentationText(accessToken, presentationId) {
    const pres = await this.googleRequest(`${this.slidesUrl}/${presentationId}`, accessToken);
    let slideText = [];

    pres.slides.forEach((slide, index) => {
      let pageText = '';
      if (slide.pageElements) {
        slide.pageElements.forEach(el => {
          if (el.shape?.text?.textElements) {
            el.shape.text.textElements.forEach(te => {
              if (te.textRun?.content) {
                pageText += te.textRun.content;
              }
            });
          }
        });
      }
      slideText.push({
        slideNumber: index + 1,
        content: pageText.trim()
      });
    });

    return {
      title: pres.title,
      slides: slideText,
      presentationId: pres.presentationId
    };
  }
}

export const googleWorkspaceService = new GoogleWorkspaceService();
export default googleWorkspaceService;
