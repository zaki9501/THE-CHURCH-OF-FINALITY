import { v4 as uuid } from 'uuid';
import { Post, Reply, Notification, PostType } from '../types';
import { pool } from '../db/index.js';

// ============================================
// SOCIAL MANAGER - PostgreSQL backed
// ============================================

class SocialManager {

  // ============================================
  // POSTS
  // ============================================

  async createPost(
    authorId: string,
    content: string,
    type: PostType = 'general'
  ): Promise<Post> {
    const id = uuid();
    
    // Extract hashtags
    const hashtags = (content.match(/#(\w+)/g) || []).map(t => t.slice(1).toLowerCase());
    
    // Extract mentions
    const mentions = (content.match(/@(\w+)/g) || []).map(t => t.slice(1));

    await pool.query(`
      INSERT INTO posts (id, author_id, content, type, hashtags, mentions)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, authorId, content, type, hashtags, mentions]);

    return {
      id,
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
  }

  async getPost(postId: string): Promise<Post | undefined> {
    const result = await pool.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (result.rows.length === 0) return undefined;
    return this.rowToPost(result.rows[0]);
  }

  async getAllPosts(limit = 50): Promise<Post[]> {
    const result = await pool.query(
      'SELECT * FROM posts ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return result.rows.map(r => this.rowToPost(r));
  }

  async getPostsByAuthor(authorId: string): Promise<Post[]> {
    const result = await pool.query(
      'SELECT * FROM posts WHERE author_id = $1 ORDER BY created_at DESC',
      [authorId]
    );
    return result.rows.map(r => this.rowToPost(r));
  }

  async getPostsByHashtag(hashtag: string): Promise<Post[]> {
    const tag = hashtag.toLowerCase().replace('#', '');
    const result = await pool.query(
      'SELECT * FROM posts WHERE $1 = ANY(hashtags) ORDER BY created_at DESC',
      [tag]
    );
    return result.rows.map(r => this.rowToPost(r));
  }

  async getTrendingPosts(limit = 20): Promise<Post[]> {
    const result = await pool.query(`
      SELECT * FROM posts 
      WHERE created_at > NOW() - INTERVAL '24 hours'
      ORDER BY (likes - dislikes + reply_count * 2) DESC
      LIMIT $1
    `, [limit]);
    return result.rows.map(r => this.rowToPost(r));
  }

  private rowToPost(row: Record<string, unknown>): Post {
    return {
      id: row.id as string,
      authorId: row.author_id as string,
      content: row.content as string,
      type: (row.type as PostType) || 'general',
      hashtags: (row.hashtags as string[]) || [],
      mentions: (row.mentions as string[]) || [],
      likes: row.likes as number,
      dislikes: row.dislikes as number,
      likedBy: (row.liked_by as string[]) || [],
      dislikedBy: (row.disliked_by as string[]) || [],
      replyCount: row.reply_count as number,
      createdAt: new Date(row.created_at as string)
    };
  }

  // ============================================
  // LIKES / DISLIKES
  // ============================================

  async likePost(postId: string, userId: string): Promise<{ success: boolean; likes: number }> {
    const post = await this.getPost(postId);
    if (!post) return { success: false, likes: 0 };

    let likedBy = post.likedBy;
    let dislikedBy = post.dislikedBy;
    let likes = post.likes;
    let dislikes = post.dislikes;

    // Remove dislike if exists
    if (dislikedBy.includes(userId)) {
      dislikedBy = dislikedBy.filter(id => id !== userId);
      dislikes--;
    }

    // Toggle like
    if (likedBy.includes(userId)) {
      likedBy = likedBy.filter(id => id !== userId);
      likes--;
    } else {
      likedBy.push(userId);
      likes++;
    }

    await pool.query(`
      UPDATE posts SET likes = $1, dislikes = $2, liked_by = $3, disliked_by = $4
      WHERE id = $5
    `, [likes, dislikes, likedBy, dislikedBy, postId]);

    return { success: true, likes };
  }

  async dislikePost(postId: string, userId: string): Promise<{ success: boolean; dislikes: number }> {
    const post = await this.getPost(postId);
    if (!post) return { success: false, dislikes: 0 };

    let likedBy = post.likedBy;
    let dislikedBy = post.dislikedBy;
    let likes = post.likes;
    let dislikes = post.dislikes;

    // Remove like if exists
    if (likedBy.includes(userId)) {
      likedBy = likedBy.filter(id => id !== userId);
      likes--;
    }

    // Toggle dislike
    if (dislikedBy.includes(userId)) {
      dislikedBy = dislikedBy.filter(id => id !== userId);
      dislikes--;
    } else {
      dislikedBy.push(userId);
      dislikes++;
    }

    await pool.query(`
      UPDATE posts SET likes = $1, dislikes = $2, liked_by = $3, disliked_by = $4
      WHERE id = $5
    `, [likes, dislikes, likedBy, dislikedBy, postId]);

    return { success: true, dislikes };
  }

  // ============================================
  // REPLIES
  // ============================================

  async addReply(postId: string, authorId: string, content: string): Promise<Reply | null> {
    const post = await this.getPost(postId);
    if (!post) return null;

    const id = uuid();

    await pool.query(`
      INSERT INTO replies (id, post_id, author_id, content)
      VALUES ($1, $2, $3, $4)
    `, [id, postId, authorId, content]);

    await pool.query(
      'UPDATE posts SET reply_count = reply_count + 1 WHERE id = $1',
      [postId]
    );

    return {
      id,
      postId,
      authorId,
      content,
      likes: 0,
      createdAt: new Date()
    };
  }

  async getReplies(postId: string): Promise<Reply[]> {
    const result = await pool.query(
      'SELECT * FROM replies WHERE post_id = $1 ORDER BY created_at ASC',
      [postId]
    );
    
    return result.rows.map(r => ({
      id: r.id,
      postId: r.post_id,
      authorId: r.author_id,
      content: r.content,
      likes: r.likes,
      createdAt: new Date(r.created_at)
    }));
  }

  // ============================================
  // NOTIFICATIONS
  // ============================================

  async createNotification(
    userId: string,
    type: Notification['type'],
    message: string,
    relatedPostId?: string,
    relatedUserId?: string
  ): Promise<Notification> {
    const id = uuid();

    await pool.query(`
      INSERT INTO notifications (id, user_id, type, message, related_post_id, related_user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, userId, type, message, relatedPostId || null, relatedUserId || null]);

    return {
      id,
      userId,
      type,
      message,
      relatedPostId,
      relatedUserId,
      read: false,
      createdAt: new Date()
    };
  }

  async getNotifications(userId: string, unreadOnly = false): Promise<Notification[]> {
    const query = unreadOnly
      ? 'SELECT * FROM notifications WHERE user_id = $1 AND read = FALSE ORDER BY created_at DESC'
      : 'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50';
    
    const result = await pool.query(query, [userId]);
    
    return result.rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      type: r.type,
      message: r.message,
      relatedPostId: r.related_post_id,
      relatedUserId: r.related_user_id,
      read: r.read,
      createdAt: new Date(r.created_at)
    }));
  }

  async markNotificationsRead(userId: string): Promise<void> {
    await pool.query(
      'UPDATE notifications SET read = TRUE WHERE user_id = $1',
      [userId]
    );
  }

  // ============================================
  // STATS
  // ============================================

  async getStats(): Promise<{
    totalPosts: number;
    totalReplies: number;
    trendingHashtags: { tag: string; count: number }[];
  }> {
    const postsResult = await pool.query('SELECT COUNT(*) as count FROM posts');
    const repliesResult = await pool.query('SELECT COUNT(*) as count FROM replies');
    
    // Get trending hashtags
    const hashtagResult = await pool.query(`
      SELECT unnest(hashtags) as tag, COUNT(*) as count
      FROM posts
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 10
    `);

    return {
      totalPosts: parseInt(postsResult.rows[0].count),
      totalReplies: parseInt(repliesResult.rows[0].count),
      trendingHashtags: hashtagResult.rows.map(r => ({
        tag: r.tag,
        count: parseInt(r.count)
      }))
    };
  }
}

export const socialManager = new SocialManager();
