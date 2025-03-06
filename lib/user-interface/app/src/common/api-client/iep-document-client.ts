// iep-document-client.ts
import { Utils } from "../utils";
import { AppConfig } from "../types";
import { ProfileClient } from "./profile-client";

export class IEPDocumentClient {
  private readonly API;
  private profileClient: ProfileClient;
  
  constructor(protected _appConfig: AppConfig) {
    this.API = _appConfig.httpEndpoint.slice(0, -1);
    this.profileClient = new ProfileClient(_appConfig);
  }
  
  // Get the kidId from the first child in the profile
  private async getDefaultKidId(): Promise<string> {
    const profile = await this.profileClient.getProfile();
    if (!profile.kids || profile.kids.length === 0) {
      throw new Error('No kids found in profile');
    }
    return profile.kids[0].kidId;
  }
  
  // Get signed URL for upload/download
  async getSignedURL(
    fileName: string,
    operation: 'upload' | 'download',
    fileType?: string
  ): Promise<any> {
    if (operation === 'upload' && !fileType) {
      throw new Error('File type is required for upload');
    }

    try {
      const kidId = await this.getDefaultKidId();
      const auth = await Utils.authenticate();
      
      const response = await fetch(this.API + '/signed-url-knowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + auth,
        },
        body: JSON.stringify({ 
          fileName, 
          fileType, 
          operation,
          kidId 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get signed URL');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  }

  // Get URL for uploading a file
  async getUploadURL(fileName: string, fileType: string): Promise<string> {
    const response = await this.getSignedURL(fileName, 'upload', fileType);
    return response.signedUrl;
  }

  // Get URL for downloading a file
  async getDownloadURL(documentUrl: string): Promise<string> {
    // Extract the filename from the document URL
    const fileName = documentUrl.split('/').pop() || '';
    const response = await this.getSignedURL(fileName, 'download');
    return response.signedUrl;
  }

  // Get all documents for the child
  async getDocuments() {
    try {
      const kidId = await this.getDefaultKidId();
      const auth = await Utils.authenticate();
      
      const response = await fetch(`${this.API}/profile/kids/${kidId}/documents`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + auth
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to get documents');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching documents:', error);
      throw error;
    }
  }

  // Get most recent processed document with its summary and sections
  async getMostRecentDocumentWithSummary() {
    try {
      const result = await this.getDocuments();
      
      // From the screenshot, we can see that the documents is actually in result.documents
      // or documents.Array, not directly in documents
      let documents = [];
      
      // Check both possible locations based on the screenshot
      if (result && result.documents && Array.isArray(result.documents)) {
        documents = result.documents;
      } else if (result && result.Array && Array.isArray(result.Array)) {
        documents = result.Array;
      } else if (result && Array.isArray(result)) {
        // Direct array case
        documents = result;
      } else {
        console.log("Document structure:", result);
        return null;
      }
      
      // Return null if documents is empty
      if (documents.length === 0) {
        return null;
      }
      
      // Based on the screenshot, we should look for documents with "PROCESSED" status
      const processedDocs = documents.filter(doc => doc.status === "PROCESSED");
      
      // If no processed documents, return null
      if (processedDocs.length === 0) {
        return null;
      }
      
      // Sort processed documents by createdAt in descending order (most recent first)
      const sortedDocs = [...processedDocs].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      
      // Get the most recent processed document
      const mostRecentDoc = sortedDocs[0];
      
      // Extract the summary if available
      let summary = null;

      let translatedSummary = null;
      
      // Extract sections if available (they're at the same level as summaries)
      // We need to traverse sections > M > en > M to get the section data
      let extractedSections = null;

      let extractedSectionsTranslated = null;

      let documentUrl = null;

      if (mostRecentDoc.summaries) {
        try {
          // Try to extract English summary from M > en > S path
          summary = mostRecentDoc.summaries.M?.en?.S || null;
          translatedSummary = mostRecentDoc.summaries.M?.vi.S || mostRecentDoc.summaries.M?.zh.S || mostRecentDoc.summaries.M?.es.S || null;
        } catch (error) {
          console.error("Error extracting summary from document:", error);
        }
      }

      if (mostRecentDoc.summaries) {
        try {
          // Try to extract English summary from M > en > S path
          summary = mostRecentDoc.summaries.M?.en?.S || null;
        } catch (error) {
          console.error("Error extracting summary from document:", error);
        }
      }

      if (mostRecentDoc.sections) {
        try {
          // Get the sections object which should have the M > en > M structure
          extractedSections = mostRecentDoc.sections.M?.en?.M || null;
          extractedSectionsTranslated = mostRecentDoc.sections.M?.vi?.M || mostRecentDoc.sections.M?.zh?.M || mostRecentDoc.sections.M?.es?.M || null;
        } catch (error) {
          console.error("Error extracting sections from document:", error);
        }
      }

      if (mostRecentDoc.documentUrl) {
        try {
          // Get the sections object which should have the M > en > M structure
          documentUrl = mostRecentDoc.documentUrl;
        } catch (error) {
          console.error("Error extracting sections from document:", error);
        }
      }
      
      // Return the document with its summary and sections
      return {
        ...mostRecentDoc,
        summary: summary,
        sections: extractedSections,
        translatedSections : extractedSectionsTranslated,
        documentUrl: documentUrl,
        translatedSummary: translatedSummary
      };
    } catch (error) {
      console.error('Error fetching most recent document with summary:', error);
      throw error;
    }
  }
  
  // Delete a document
  async deleteFile(iepId: string) {
    try {
      const kidId = await this.getDefaultKidId();
      const auth = await Utils.authenticate();
      
      const response = await fetch(`${this.API}/profile/kids/${kidId}/documents/${iepId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + auth
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete document');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }
}