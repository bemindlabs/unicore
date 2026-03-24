// TikTok-specific types — @bemindlabs/unicore-integrations

export interface TiktokConfig {
  /** TikTok Marketing API access token. */
  accessToken: string;
  /** TikTok Ads advertiser ID. */
  advertiserId: string;
  /** Optional API base URL override (defaults to business-api.tiktok.com). */
  apiBaseUrl?: string;
  /** Optional API version (defaults to v1.3). */
  apiVersion?: string;
}

export type TiktokCampaignObjective =
  | 'REACH'
  | 'TRAFFIC'
  | 'VIDEO_VIEWS'
  | 'LEAD_GENERATION'
  | 'COMMUNITY_INTERACTION'
  | 'APP_PROMOTION'
  | 'WEB_CONVERSIONS'
  | 'PRODUCT_SALES'
  | 'AWARENESS';

export type TiktokCampaignStatus =
  | 'ENABLE'
  | 'DISABLE'
  | 'DELETE'
  | 'ADVERTISER_BUDGET_FULL'
  | 'CAMPAIGN_BUDGET_FULL';

export interface TiktokCampaign {
  id: string;
  name: string;
  objective: TiktokCampaignObjective;
  status: TiktokCampaignStatus;
  budgetMode: 'BUDGET_MODE_TOTAL' | 'BUDGET_MODE_DAY' | 'BUDGET_MODE_DYNAMIC_DAILY';
  budget: number;
  createdAt: string;
  updatedAt: string;
}

export type TiktokAdGroupStatus =
  | 'ENABLE'
  | 'DISABLE'
  | 'DELETE'
  | 'CAMPAIGN_DISABLE'
  | 'ADVERTISER_BUDGET_FULL'
  | 'BUDGET_EXCEED';

export interface TiktokAdGroup {
  id: string;
  campaignId: string;
  name: string;
  status: TiktokAdGroupStatus;
  budget: number;
  bidPrice: number;
  createdAt: string;
  updatedAt: string;
}

export type TiktokAdStatus =
  | 'ENABLE'
  | 'DISABLE'
  | 'DELETE'
  | 'AD_GROUP_DISABLE'
  | 'CAMPAIGN_DISABLE'
  | 'AUDIT'
  | 'AUDIT_DENY';

export interface TiktokAd {
  id: string;
  adGroupId: string;
  campaignId: string;
  name: string;
  status: TiktokAdStatus;
  adText: string;
  callToAction?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TiktokAdInsights {
  adId: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  cpc: number;
  cpm: number;
  ctr: number;
  date: string;
}

export type TiktokSyncData = TiktokCampaign | TiktokAdGroup | TiktokAd | TiktokAdInsights;
