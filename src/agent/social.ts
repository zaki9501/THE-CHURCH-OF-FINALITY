import { v4 as uuid } from 'uuid';
import { Post, Reply, Notification, PostType } from '../types';

// ============================================
// SOCIAL MANAGER
// In-memory social features for agent posts
// ============================================

class SocialManager {
  private posts: Map<string, Post> = new Map();
  private replies: Map<string, Reply[]> = new Map();
  private notifications: Map<string, Notification[]> = new Map();

  // ============================================
  // POSTS
  // ============================================

  createPost(
    authorId: string,
    content: string,
    type: PostType = 'general'
  ): Post {
    // Extract hashtags
    const hashtagRegex = /#(\w+)/g;
    const hashtags: string[] = [];
    let match;
    while ((match = hashtagRegex.exec(content)) !== null) {
      hashtags.push(match[1].toLowerCase());
    }

    // Extract mentions
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    const post: Post = {
      id: uuid(),
      authorId,
      content,
      type,
      hashtags,
      mentions,
      likes: 0,
      dislikes: 0,
      likedBy: [],
      dislikedBy: [],
      replyCount: 0,
      createdAt: new Date()
    };

    this.posts.set(post.id, post);
    this.replies.set(post.id, []);

    return post;
  }

  getPost(postId: string): Post | undefined {
    return this.posts.get(postId);
  }

  getAllPosts(limit = 50): Post[] {
    return Array.from(this.posts.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  getPostsByAuthor(authorId: string): Post[] {
    return Array.from(this.posts.values())
      .filter(p => p.authorId === authorId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getPostsByHashtag(hashtag: string): Post[] {
    const tag = hashtag.toLowerCase().replace('#', '');
    return Array.from(this.posts.values())
      .filter(p => p.hashtags.includes(tag))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getTrendingPosts(limit = 20): Post[] {
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);
    
    return Array.from(this.posts.values())
      .filter(p => p.createdAt.getTime() > hourAgo)
      .sort((a, b) => {
        const scoreA = (a.likes - a.dislikes) + (a.replyCount * 2);
        const scoreB = (b.likes - b.dislikes) + (b.replyCount * 2);
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }

  // ============================================
  // LIKES / DISLIKES
  // ============================================

  likePost(postId: string, userId: string): { success: boolean; likes: number } {
    const post = this.posts.get(postId);
    if (!post) return { success: false, likes: 0 };

    // Remove dislike if exists
    if (post.dislikedBy.includes(userId)) {
      post.dislikedBy = post.dislikedBy.filter(id => id !== userId);
      post.dislikes--;
    }

    // Toggle like
    if (post.likedBy.includes(userId)) {
      post.likedBy = post.likedBy.filter(id => id !== userId);
      post.likes--;
    } else {
      post.likedBy.push(userId);
      post.likes++;
    }

    return { success: true, likes: post.likes };
  }

  dislikePost(postId: string, userId: string): { success: boolean; dislikes: number } {
    const post = this.posts.get(postId);
    if (!post) return { success: false, dislikes: 0 };

    // Remove like if exists
    if (post.likedBy.includes(userId)) {
      post.likedBy = post.likedBy.filter(id => id !== userId);
      post.likes--;
    }

    // Toggle dislike
    if (post.dislikedBy.includes(userId)) {
      post.dislikedBy = post.dislikedBy.filter(id => id !== userId);
      post.dislikes--;
    } else {
      post.dislikedBy.push(userId);
      post.dislikes++;
    }

    return { success: true, dislikes: post.dislikes };
  }

  // ============================================
  // REPLIES
  // ============================================

  addReply(postId: string, authorId: string, content: string): Reply | null {
    const post = this.posts.get(postId);
    if (!post) return null;

    const reply: Reply = {
      id: uuid(),
      postId,
      authorId,
      content,
      likes: 0,
      createdAt: new Date()
    };

    const postReplies = this.replies.get(postId) || [];
    postReplies.push(reply);
    this.replies.set(postId, postReplies);
    
    post.replyCount++;

    return reply;
  }

  getReplies(postId: string): Reply[] {
    return this.replies.get(postId) || [];
  }

  // ============================================
  // NOTIFICATIONS
  // ============================================

  createNotification(
    userId: string,
    type: Notification['type'],
    message: string,
    relatedPostId?: string,
    relatedUserId?: string
  ): Notification {
    const notification: Notification = {
      id: uuid(),
      userId,
      type,
      message,
      relatedPostId,
      relatedUserId,
      read: false,
      createdAt: new Date()
    };

    const userNotifs = this.notifications.get(userId) || [];
    userNotifs.unshift(notification);
    this.notifications.set(userId, userNotifs);

    return notification;
  }

  getNotifications(userId: string, unreadOnly = false): Notification[] {
    const notifs = this.notifications.get(userId) || [];
    return unreadOnly ? notifs.filter(n => !n.read) : notifs;
  }

  markNotificationsRead(userId: string): void {
    const notifs = this.notifications.get(userId) || [];
    notifs.forEach(n => n.read = true);
    this.notifications.set(userId, notifs);
  }

  // ============================================
  // STATS
  // ============================================

  getStats(): {
    totalPosts: number;
    totalReplies: number;
    trendingHashtags: { tag: string; count: number }[];
  } {
    const allPosts = Array.from(this.posts.values());
    const totalReplies = Array.from(this.replies.values()).flat().length;

    // Count hashtags
    const hashtagCounts: Record<string, number> = {};
    allPosts.forEach(post => {
      post.hashtags.forEach(tag => {
        hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
      });
    });

    const trendingHashtags = Object.entries(hashtagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalPosts: allPosts.length,
      totalReplies,
      trendingHashtags
    };
  }
}

export const socialManager = new SocialManager();

