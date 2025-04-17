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
  
  // Get the childId from the first child in the profile
  private async getDefaultChildId(): Promise<string> {
    const profile = await this.profileClient.getProfile();
    if (!profile.children || profile.children.length === 0) {
      throw new Error('No children found in profile');
    }
    return profile.children[0].childId;
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
      const childId = await this.getDefaultChildId();
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
          childId 
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
      const childId = await this.getDefaultChildId();
      const auth = await Utils.authenticate();
      
      const response = await fetch(`${this.API}/profile/children/${childId}/documents`, {
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
      console.log("Document API response:", result);
      
      // If no document is found, return null
      if (!result || Object.keys(result).length === 0) {
        console.log("No document found");
        return null;
      }
      
      return result;
    } catch (error) {
      console.error('Error fetching most recent document with summary:', error);
      throw error;
    }
  }
  
  // Delete a document
  async deleteFile(iepId: string) {
    try {
      const childId = await this.getDefaultChildId();
      const auth = await Utils.authenticate();
      
      const response = await fetch(`${this.API}/profile/children/${childId}/documents/${iepId}`, {
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