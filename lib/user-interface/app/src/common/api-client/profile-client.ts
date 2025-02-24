import { Utils } from "../utils";
import { AppConfig, UserProfile, KidResponse } from "../types";

export class ProfileClient {
  private readonly API;
  
  constructor(protected _appConfig: AppConfig) {
    this.API = _appConfig.httpEndpoint.slice(0, -1);
  }

  async getProfile(): Promise<UserProfile> {
    const auth = await Utils.authenticate();
    const response = await fetch(`${this.API}/profile`, {
      headers: {
        'Authorization': auth,
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
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(profile)
    });

    if (!response.ok) {
      throw new Error('Failed to update profile');
    }
  }

  async addKid(name: string, schoolCity: string): Promise<KidResponse> {
    const auth = await Utils.authenticate();
    const response = await fetch(`${this.API}/profile/kids`, {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, schoolCity })
    });

    if (!response.ok) {
      throw new Error('Failed to add kid');
    }

    return response.json();
  }
}