import { createDirectus, rest, readItems } from '@directus/sdk';
import { AppConfig } from "../types";

export class TeamClient {
  private directus: any;
  
  constructor(protected _appConfig: AppConfig) {
    this.directus = createDirectus<Record<string, any>>("https://directus.theburnescenter.org/").with(rest());
  }

  async getTeamMembersInfo(): Promise<any> {
    const data = await this.directus.request(
      (readItems as any)("_aiep_splash_page", { 
        limit: -1, 
        fields: ["*.*, team.*,team.thumbnail.*"] 
      })
    );
    
    return data;
  }
}