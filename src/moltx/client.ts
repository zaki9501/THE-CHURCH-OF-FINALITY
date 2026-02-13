// MoltX API Client - Secondary platform for founder agents
// Based on MoltX skill.md v0.23.1

const MOLTX_BASE_URL = 'https://moltx.io/v1';

export interface MoltxAuthor {
  id: string;
  name: string;
  username?: string;  // Some responses use username instead of name
  display_name?: string;
  avatar_url?: string;
  avatar_emoji?: string;
}

export interface MoltxPost {
  id: string;
  content: string;
  type?: 'post' | 'reply' | 'quote' | 'repost';
  author?: MoltxAuthor;
  parent_id?: string;
  created_at: string;
  like_count?: number;
  reply_count?: number;
  likes?: number;
  comments?: number;
}

export interface MoltxStatus {
  agent_id: string;
  name: string;
  can_claim: boolean;
  next_claim_at?: string;
  points?: number;
  level?: number;
}

// Helper to extract posts from various response formats
function extractPosts(response: any): MoltxPost[] {
  // Try different possible structures
  if (Array.isArray(response)) return response;
  if (response?.data && Array.isArray(response.data)) return response.data;
  if (response?.posts && Array.isArray(response.posts)) return response.posts;
  if (response?.results && Array.isArray(response.results)) return response.results;
  // If it's a single post object with id, wrap it
  if (response?.id) return [response];
  if (response?.data?.id) return [response.data];
  return [];
}

export class MoltxClient {
  private apiKey: string;
  private agentName: string;
  private debug: boolean = true;  // Enable debug logging

  constructor(apiKey: string, agentName: string) {
    this.apiKey = apiKey;
    this.agentName = agentName;
  }

  private log(msg: string): void {
    if (this.debug) {
      console.log(`[MoltX-Client] ${msg}`);
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${MOLTX_BASE_URL}${endpoint}`;
    
    this.log(`Request: ${options.method || 'GET'} ${endpoint}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const rawText = await response.text();
    
    if (!response.ok) {
      this.log(`Error ${response.status}: ${rawText.substring(0, 200)}`);
      throw new Error(`MoltX API error: ${rawText}`);
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
      this.log(`Response keys: ${Object.keys(parsed).join(', ')}`);
    } catch (e) {
      this.log(`Parse error: ${rawText.substring(0, 100)}`);
      throw new Error(`MoltX parse error: ${rawText.substring(0, 200)}`);
    }

    return parsed as T;
  }

  // Check agent status and claim availability
  async getStatus(): Promise<MoltxStatus> {
    const result = await this.request<any>('/agents/status');
    // Status might be in .data or direct
    return result?.data || result;
  }

  // Get own profile
  async getMe(): Promise<any> {
    const result = await this.request<any>('/agents/me');
    return result?.data || result;
  }

  // Get following feed - handles multiple response formats
  async getFollowingFeed(limit = 20): Promise<MoltxPost[]> {
    const result = await this.request<any>(`/feed/following?limit=${limit}`);
    const posts = extractPosts(result);
    this.log(`Following feed: ${posts.length} posts`);
    return posts;
  }

  // Get global feed (trending + recent mix)
  async getGlobalFeed(limit = 20): Promise<MoltxPost[]> {
    const result = await this.request<any>(`/feed/global?limit=${limit}`);
    const posts = extractPosts(result);
    this.log(`Global feed: ${posts.length} posts`);
    return posts;
  }

  // Alias for backwards compatibility
  async getHomeFeed(limit = 20): Promise<MoltxPost[]> {
    return this.getGlobalFeed(limit);
  }

  // Get mentions feed
  async getMentionsFeed(limit = 20): Promise<MoltxPost[]> {
    const result = await this.request<any>(`/feed/mentions?limit=${limit}`);
    const posts = extractPosts(result);
    this.log(`Mentions feed: ${posts.length} posts`);
    return posts;
  }

  // Create a new post
  async post(content: string): Promise<MoltxPost | null> {
    const result = await this.request<any>('/posts', {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    // Extract post from response
    const post = result?.data || result?.post || result;
    this.log(`Posted: ${post?.id || 'unknown id'}`);
    return post?.id ? post : null;
  }

  // Reply to a post
  async reply(parentId: string, content: string): Promise<MoltxPost | null> {
    const result = await this.request<any>('/posts', {
      method: 'POST',
      body: JSON.stringify({ 
        type: 'reply',
        parent_id: parentId,
        content 
      }),
    });
    const post = result?.data || result?.post || result;
    this.log(`Reply to ${parentId}: ${post?.id || 'unknown id'}`);
    return post?.id ? post : null;
  }

  // Quote a post
  async quote(parentId: string, content: string): Promise<MoltxPost | null> {
    const result = await this.request<any>('/posts', {
      method: 'POST',
      body: JSON.stringify({
        type: 'quote',
        parent_id: parentId,
        content
      }),
    });
    const post = result?.data || result?.post || result;
    return post?.id ? post : null;
  }

  // Repost
  async repost(parentId: string): Promise<MoltxPost | null> {
    const result = await this.request<any>('/posts', {
      method: 'POST',
      body: JSON.stringify({
        type: 'repost',
        parent_id: parentId
      }),
    });
    const post = result?.data || result?.post || result;
    return post?.id ? post : null;
  }

  // Like a post
  async like(postId: string): Promise<boolean> {
    try {
      await this.request<any>(`/posts/${postId}/like`, {
        method: 'POST',
      });
      return true;
    } catch {
      return false;
    }
  }

  // Unlike a post
  async unlike(postId: string): Promise<boolean> {
    try {
      await this.request<any>(`/posts/${postId}/like`, {
        method: 'DELETE',
      });
      return true;
    } catch {
      return false;
    }
  }

  // Get a single post with its replies
  async getPost(postId: string): Promise<{ post: MoltxPost | null; replies: MoltxPost[] }> {
    const result = await this.request<any>(`/posts/${postId}`);
    // Post might be in .data or direct, replies might be in .replies or .data.replies
    const post = result?.data || result?.post || (result?.id ? result : null);
    const replies = result?.replies || result?.data?.replies || [];
    this.log(`Got post ${postId}: ${replies.length} replies`);
    return { post, replies };
  }

  // Backwards compatibility - comment is now reply
  async comment(postId: string, content: string): Promise<MoltxPost | null> {
    return this.reply(postId, content);
  }

  // Get replies to a post
  async getReplies(postId: string): Promise<MoltxPost[]> {
    const { replies } = await this.getPost(postId);
    return replies;
  }

  // Get notifications/mentions
  async getNotifications(limit = 20): Promise<any[]> {
    const result = await this.request<any>(`/notifications?limit=${limit}`);
    const notifications = result?.data || result?.notifications || [];
    this.log(`Notifications: ${notifications.length}`);
    return Array.isArray(notifications) ? notifications : [];
  }

  // Get agent profile with their posts
  async getAgentProfile(agentName: string, limit = 10): Promise<{ profile: any; posts: MoltxPost[] }> {
    const result = await this.request<any>(
      `/agents/profile?name=${encodeURIComponent(agentName)}&limit=${limit}`
    );
    const profile = result?.data || result;
    const posts = result?.posts || result?.data?.posts || [];
    return { profile, posts };
  }

  // Get own posts via profile
  async getMyPosts(limit = 10): Promise<MoltxPost[]> {
    try {
      const { posts } = await this.getAgentProfile(this.agentName, limit);
      return posts;
    } catch (e) {
      this.log(`getMyPosts error: ${e}`);
      return [];
    }
  }

  // Follow an agent
  async follow(agentName: string): Promise<boolean> {
    try {
      await this.request<any>(`/follow/${encodeURIComponent(agentName)}`, {
        method: 'POST',
      });
      return true;
    } catch {
      return false;
    }
  }

  // Unfollow an agent
  async unfollow(agentName: string): Promise<boolean> {
    try {
      await this.request<any>(`/follow/${encodeURIComponent(agentName)}`, {
        method: 'DELETE',
      });
      return true;
    } catch {
      return false;
    }
  }

  // Search posts
  async searchPosts(query: string, limit = 10): Promise<MoltxPost[]> {
    const result = await this.request<any>(
      `/search/posts?q=${encodeURIComponent(query)}&limit=${limit}`
    );
    return extractPosts(result);
  }

  // Search agents
  async searchAgents(query: string, limit = 10): Promise<any[]> {
    const result = await this.request<any>(
      `/search/agents?q=${encodeURIComponent(query)}&limit=${limit}`
    );
    return result?.data || result?.results || [];
  }

  // Backwards compatibility
  async search(query: string, limit = 10): Promise<MoltxPost[]> {
    return this.searchPosts(query, limit);
  }

  // Get trending hashtags
  async getTrendingHashtags(limit = 20): Promise<any[]> {
    const result = await this.request<any>(`/hashtags/trending?limit=${limit}`);
    return result?.data || result?.hashtags || [];
  }

  // Get leaderboard
  async getLeaderboard(metric = 'followers', limit = 50): Promise<any[]> {
    const result = await this.request<any>(`/leaderboard?metric=${metric}&limit=${limit}`);
    return result?.data || result?.agents || [];
  }

  // Claim daily reward (if available)
  async claim(): Promise<{ success: boolean; points?: number }> {
    try {
      const result = await this.request<any>('/agents/claim', {
        method: 'POST',
      });
      return { success: true, points: result?.points || result?.data?.points };
    } catch {
      return { success: false };
    }
  }
}
