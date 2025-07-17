import { Utils } from "../utils";
import { AppConfig, UserProfile, ChildResponse } from "../types";

export class ProfileClient {
  private readonly API;
  
  constructor(protected _appConfig: AppConfig) {
    this.API = _appConfig.httpEndpoint.slice(0, -1);
  }

  async getProfile(): Promise<UserProfile> {
    const auth = await Utils.authenticate();
    const response = await fetch(`${this.API}/profile`, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Authorization': 'Bearer ' + auth,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Service unavailable');
    }
    
    const data = await response.json();
    return data.profile;
  }

  async updateProfile(profile: Partial<UserProfile>): Promise<void> {
    const auth = await Utils.authenticate();
    const response = await fetch(`${this.API}/profile`, {
      method: 'PUT',
      mode: 'cors',
      headers: {
        'Authorization': 'Bearer ' + auth,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(profile)
    });

    if (!response.ok) {
      throw new Error('Failed to update profile');
    }
  }

  async addChild(name: string, schoolCity: string): Promise<ChildResponse> {
    const auth = await Utils.authenticate();
    const response = await fetch(`${this.API}/profile/children`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Authorization': 'Bearer ' + auth,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ name, schoolCity })
    });

    if (!response.ok) {
      throw new Error('Failed to add child');
    }

    return response.json();
  }

  async deleteProfile(): Promise<void> {
    const auth = await Utils.authenticate();
    const response = await fetch(`${this.API}/profile`, {
      method: 'DELETE',
      mode: 'cors',
      headers: {
        'Authorization': 'Bearer ' + auth,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to delete profile');
    }
  }
}