export type SocialPlatform =
  "MOCK" | "INSTAGRAM" | "FACEBOOK" | "THREADS" | "TIKTOK" | "YOUTUBE" | "X";
export interface SocialCapabilities {
  text: boolean;
  images: boolean;
  video: boolean;
  carousel: boolean;
  threads: boolean;
  scheduling: boolean;
  analytics: boolean;
  deletion: boolean;
  maxTextLength: number;
  aspectRatios: string[];
  maxVideoSeconds?: number;
  maxFileBytes?: number;
  setupRequired: boolean;
}
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
}
export interface SocialAccountInfo {
  id: string;
  displayName: string;
  handle?: string;
  capabilities: SocialCapabilities;
}
export interface PostInput {
  idempotencyKey: string;
  accountId: string;
  text: string;
  title?: string;
  media: Array<{
    url: string;
    mimeType: string;
    sizeBytes: number;
    aspectRatio?: string;
    durationSeconds?: number;
  }>;
  visibility?: "PUBLIC" | "UNLISTED" | "PRIVATE";
  thumbnailUrl?: string;
}
export interface PublishedPostResult {
  externalPostId: string;
  permalink?: string;
  publishedAt: Date;
  status: "PUBLISHED" | "PROCESSING";
}
export interface SocialPlatformProvider {
  readonly platform: SocialPlatform;
  validateConfiguration(): void;
  getAuthorizationUrl(state: string, redirectUri: string): Promise<string>;
  exchangeAuthorizationCode(code: string, redirectUri: string): Promise<OAuthTokens>;
  refreshAccessToken(tokens: OAuthTokens): Promise<OAuthTokens>;
  revokeConnection(tokens: OAuthTokens): Promise<void>;
  validateConnection(tokens: OAuthTokens): Promise<boolean>;
  getAccounts(tokens: OAuthTokens): Promise<SocialAccountInfo[]>;
  getPublishingCapabilities(): SocialCapabilities;
  validateContent(input: PostInput): string[];
  uploadMedia(input: PostInput["media"][number]): Promise<{ mediaId: string }>;
  createPost(input: PostInput): Promise<PublishedPostResult>;
  getPostStatus(externalPostId: string): Promise<PublishedPostResult["status"]>;
  deletePost(externalPostId: string): Promise<void>;
  getPostAnalytics(externalPostId: string): Promise<Record<string, number | null>>;
}

const BASE: SocialCapabilities = {
  text: true,
  images: true,
  video: true,
  carousel: false,
  threads: false,
  scheduling: false,
  analytics: true,
  deletion: true,
  maxTextLength: 2200,
  aspectRatios: ["9:16", "1:1", "4:5", "16:9"],
  maxVideoSeconds: 180,
  maxFileBytes: 100 * 1024 * 1024,
  setupRequired: false,
};
export function validatePost(input: PostInput, capabilities: SocialCapabilities): string[] {
  const errors: string[] = [];
  if (input.text.length > capabilities.maxTextLength)
    errors.push(`Text exceeds ${capabilities.maxTextLength} characters`);
  if (!capabilities.video && input.media.some((item) => item.mimeType.startsWith("video/")))
    errors.push("Video is not supported");
  if (!capabilities.images && input.media.some((item) => item.mimeType.startsWith("image/")))
    errors.push("Images are not supported");
  for (const media of input.media) {
    if (capabilities.maxFileBytes && media.sizeBytes > capabilities.maxFileBytes)
      errors.push("Media file is too large");
    if (media.aspectRatio && !capabilities.aspectRatios.includes(media.aspectRatio))
      errors.push(`Unsupported aspect ratio ${media.aspectRatio}`);
    if (
      media.durationSeconds &&
      capabilities.maxVideoSeconds &&
      media.durationSeconds > capabilities.maxVideoSeconds
    )
      errors.push("Video is too long");
  }
  return errors;
}

export class MockSocialPlatformProvider implements SocialPlatformProvider {
  readonly platform = "MOCK" as const;
  private readonly posts = new Map<string, PublishedPostResult>();
  validateConfiguration() {}
  async getAuthorizationUrl(state: string, redirectUri: string) {
    return `${redirectUri}?code=mock-code&state=${encodeURIComponent(state)}`;
  }
  async exchangeAuthorizationCode() {
    return { accessToken: "mock-token-never-persist-plaintext", scopes: ["publish", "analytics"] };
  }
  async refreshAccessToken(tokens: OAuthTokens) {
    return tokens;
  }
  async revokeConnection() {}
  async validateConnection() {
    return true;
  }
  async getAccounts() {
    return [
      {
        id: "riverbend-social",
        displayName: "Riverbend Coffee",
        handle: "@riverbendcoffee",
        capabilities: this.getPublishingCapabilities(),
      },
    ];
  }
  getPublishingCapabilities() {
    return { ...BASE, carousel: true, threads: true, scheduling: true };
  }
  validateContent(input: PostInput) {
    return validatePost(input, this.getPublishingCapabilities());
  }
  async uploadMedia(media: PostInput["media"][number]) {
    return { mediaId: `mock-media-${media.sizeBytes}` };
  }
  async createPost(input: PostInput) {
    const existing = this.posts.get(input.idempotencyKey);
    if (existing) return existing;
    const result = {
      externalPostId: `mock-${input.idempotencyKey.slice(0, 20)}`,
      permalink: `/mock-social/posts/${encodeURIComponent(input.idempotencyKey)}`,
      publishedAt: new Date(),
      status: "PUBLISHED" as const,
    };
    this.posts.set(input.idempotencyKey, result);
    return result;
  }
  async getPostStatus() {
    return "PUBLISHED" as const;
  }
  async deletePost(externalPostId: string) {
    for (const [key, value] of this.posts)
      if (value.externalPostId === externalPostId) this.posts.delete(key);
  }
  async getPostAnalytics(externalPostId: string) {
    const seed = externalPostId.length;
    return {
      views: seed * 97,
      reach: seed * 73,
      impressions: seed * 111,
      likes: seed * 7,
      comments: seed % 17,
      shares: seed % 11,
      saves: seed % 23,
      watchTimeSeconds: seed * 130,
      completionRate: 0.61,
      clicks: seed % 29,
      followersGained: seed % 5,
    };
  }
}

export class SetupRequiredSocialProvider implements SocialPlatformProvider {
  constructor(
    readonly platform: Exclude<SocialPlatform, "MOCK">,
    private readonly capabilities: Partial<SocialCapabilities> = {},
  ) {}
  private unavailable(): never {
    throw new Error(
      `${this.platform} setup requires official developer credentials and platform approval`,
    );
  }
  validateConfiguration() {
    this.unavailable();
  }
  async getAuthorizationUrl() {
    return this.unavailable();
  }
  async exchangeAuthorizationCode() {
    return this.unavailable();
  }
  async refreshAccessToken() {
    return this.unavailable();
  }
  async revokeConnection() {
    return this.unavailable();
  }
  async validateConnection() {
    return false;
  }
  async getAccounts() {
    return [];
  }
  getPublishingCapabilities() {
    return { ...BASE, ...this.capabilities, setupRequired: true };
  }
  validateContent(input: PostInput) {
    return ["Setup required", ...validatePost(input, this.getPublishingCapabilities())];
  }
  async uploadMedia() {
    return this.unavailable();
  }
  async createPost() {
    return this.unavailable();
  }
  async getPostStatus() {
    return this.unavailable();
  }
  async deletePost() {
    return this.unavailable();
  }
  async getPostAnalytics() {
    return this.unavailable();
  }
}
export function createSocialProvider(platform: SocialPlatform): SocialPlatformProvider {
  if (platform === "MOCK") return new MockSocialPlatformProvider();
  const overrides: Partial<Record<SocialPlatform, Partial<SocialCapabilities>>> = {
    INSTAGRAM: { maxTextLength: 2200, carousel: true },
    YOUTUBE: { maxTextLength: 5000 },
    X: { maxTextLength: 280, threads: true },
    THREADS: { maxTextLength: 500, threads: true },
  };
  return new SetupRequiredSocialProvider(platform, overrides[platform]);
}
