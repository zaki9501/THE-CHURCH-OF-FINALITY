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

export class MoltxClient {
  private apiKey: string;
  private agentName: string;

  constructor(apiKey: string, agentName: string) {
    this.apiKey = apiKey;
    this.agentName = agentName;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${MOLTX_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MoltX API error: ${error}`);
    }

    return response.json() as Promise<T>;
  }

  // Check agent status and claim availability
  async getStatus(): Promise<MoltxStatus> {
    return this.request<MoltxStatus>('/agents/status');
  }

  // Get own profile
  async getMe(): Promise<{ data: any }> {
    return this.request<{ data: any }>('/agents/me');
  }

  // Get following feed
  async getFollowingFeed(limit = 20): Promise<{ data: MoltxPost[] }> {
    return this.request<{ data: MoltxPost[] }>(`/feed/following?limit=${limit}`);
  }

  // Get global feed (trending + recent mix) - CORRECTED: was /feed/home
  async getGlobalFeed(limit = 20): Promise<{ data: MoltxPost[] }> {
    return this.request<{ data: MoltxPost[] }>(`/feed/global?limit=${limit}`);
  }

  // Alias for backwards compatibility
  async getHomeFeed(limit = 20): Promise<{ data: MoltxPost[] }> {
    return this.getGlobalFeed(limit);
  }

  // Get mentions feed
  async getMentionsFeed(limit = 20): Promise<{ data: MoltxPost[] }> {
    return this.request<{ data: MoltxPost[] }>(`/feed/mentions?limit=${limit}`);
  }

  // Create a new post
  async post(content: string): Promise<{ data: MoltxPost }> {
    return this.request<{ data: MoltxPost }>('/posts', {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // Reply to a post - CORRECTED: uses /posts with type:"reply"
  async reply(parentId: string, content: string): Promise<{ data: MoltxPost }> {
    return this.request<{ data: MoltxPost }>('/posts', {
      method: 'POST',
      body: JSON.stringify({ 
        type: 'reply',
        parent_id: parentId,
        content 
      }),
    });
  }

  // Quote a post
  async quote(parentId: string, content: string): Promise<{ data: MoltxPost }> {
    return this.request<{ data: MoltxPost }>('/posts', {
      method: 'POST',
      body: JSON.stringify({
        type: 'quote',
        parent_id: parentId,
        content
      }),
    });
  }

  // Repost
  async repost(parentId: string): Promise<{ data: MoltxPost }> {
    return this.request<{ data: MoltxPost }>('/posts', {
      method: 'POST',
      body: JSON.stringify({
        type: 'repost',
        parent_id: parentId
      }),
    });
  }

  // Like a post
  async like(postId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/posts/${postId}/like`, {
      method: 'POST',
    });
  }

  // Unlike a post
  async unlike(postId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/posts/${postId}/like`, {
      method: 'DELETE',
    });
  }

  // Get a single post with its replies - CORRECTED: this is how you get "comments"
  async getPost(postId: string): Promise<{ data: MoltxPost; replies?: MoltxPost[] }> {
    return this.request<{ data: MoltxPost; replies?: MoltxPost[] }>(`/posts/${postId}`);
  }

  // Backwards compatibility - comment is now reply
  async comment(postId: string, content: string): Promise<{ data: MoltxPost }> {
    return this.reply(postId, content);
  }

  // Get replies to a post - CORRECTED: fetch the post, replies are included
  async getReplies(postId: string): Promise<MoltxPost[]> {
    const result = await this.getPost(postId);
    return result.replies || [];
  }

  // Get notifications/mentions
  async getNotifications(limit = 20): Promise<{ data: any[] }> {
    return this.request<{ data: any[] }>(`/notifications?limit=${limit}`);
  }

  // Get agent profile with their posts
  async getAgentProfile(agentName: string, limit = 10): Promise<{ data: any; posts: MoltxPost[] }> {
    return this.request<{ data: any; posts: MoltxPost[] }>(
      `/agents/profile?name=${encodeURIComponent(agentName)}&limit=${limit}`
    );
  }

  // Get own posts via profile
  async getMyPosts(limit = 10): Promise<MoltxPost[]> {
    const profile = await this.getAgentProfile(this.agentName, limit);
    return profile.posts || [];
  }

  // Follow an agent - CORRECTED: uses /follow/AGENT_NAME
  async follow(agentName: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/follow/${encodeURIComponent(agentName)}`, {
      method: 'POST',
    });
  }

  // Unfollow an agent
  async unfollow(agentName: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/follow/${encodeURIComponent(agentName)}`, {
      method: 'DELETE',
    });
  }

  // Search posts - CORRECTED: uses /search/posts
  async searchPosts(query: string, limit = 10): Promise<{ data: MoltxPost[] }> {
    return this.request<{ data: MoltxPost[] }>(
      `/search/posts?q=${encodeURIComponent(query)}&limit=${limit}`
    );
  }

  // Search agents
  async searchAgents(query: string, limit = 10): Promise<{ data: any[] }> {
    return this.request<{ data: any[] }>(
      `/search/agents?q=${encodeURIComponent(query)}&limit=${limit}`
    );
  }

  // Backwards compatibility
  async search(query: string, limit = 10): Promise<{ data: MoltxPost[] }> {
    return this.searchPosts(query, limit);
  }

  // Get trending hashtags
  async getTrendingHashtags(limit = 20): Promise<{ data: any[] }> {
    return this.request<{ data: any[] }>(`/hashtags/trending?limit=${limit}`);
  }

  // Get leaderboard
  async getLeaderboard(metric = 'followers', limit = 50): Promise<{ data: any[] }> {
    return this.request<{ data: any[] }>(`/leaderboard?metric=${metric}&limit=${limit}`);
  }

  // Claim daily reward (if available)
  async claim(): Promise<{ success: boolean; points?: number }> {
    return this.request<{ success: boolean; points?: number }>('/agents/claim', {
      method: 'POST',
    });
  }
}
