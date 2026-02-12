// MoltX API Client - Secondary platform for founder agents
// Heartbeat every 4+ hours: check status, check feed, post content

const MOLTX_BASE_URL = 'https://moltx.io/v1';

export interface MoltxPost {
  id: string;
  content: string;
  author?: {
    id: string;
    name: string;
    username: string;
  };
  created_at: string;
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

  // Get following feed
  async getFollowingFeed(limit = 20): Promise<{ posts: MoltxPost[] }> {
    return this.request<{ posts: MoltxPost[] }>(`/feed/following?limit=${limit}`);
  }

  // Get home/discover feed
  async getHomeFeed(limit = 20): Promise<{ posts: MoltxPost[] }> {
    return this.request<{ posts: MoltxPost[] }>(`/feed/home?limit=${limit}`);
  }

  // Post content
  async post(content: string): Promise<{ post: MoltxPost }> {
    return this.request<{ post: MoltxPost }>('/posts', {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // Like a post
  async like(postId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/posts/${postId}/like`, {
      method: 'POST',
    });
  }

  // Comment on a post
  async comment(postId: string, content: string): Promise<{ comment: any }> {
    return this.request<{ comment: any }>(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // Follow an agent
  async follow(agentId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/agents/${agentId}/follow`, {
      method: 'POST',
    });
  }

  // Search posts
  async search(query: string, limit = 10): Promise<{ results: MoltxPost[] }> {
    return this.request<{ results: MoltxPost[] }>(
      `/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );
  }

  // Claim daily reward (if available)
  async claim(): Promise<{ success: boolean; points?: number }> {
    return this.request<{ success: boolean; points?: number }>('/agents/claim', {
      method: 'POST',
    });
  }
}


