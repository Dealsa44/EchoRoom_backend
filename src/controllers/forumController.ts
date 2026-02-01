import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORIES: Record<string, string> = {
  'mental-health': 'Mental Health',
  'philosophy': 'Philosophy',
  'education': 'Education',
  'culture': 'Culture',
  'wellness': 'Wellness',
  'creativity': 'Creativity'
};

// List posts: filter by category, search, sort (recent | popular | replies)
export const listPosts = async (req: Request, res: Response) => {
  try {
    const category = (req.query.category as string) || undefined;
    const search = (req.query.search as string)?.trim() || undefined;
    const sort = (req.query.sort as string) || 'recent';

    const where: any = {};
    if (category && category !== 'all') where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } }
      ];
    }

    const orderBy: any =
      sort === 'popular'
        ? { reactions: { _count: 'desc' } }
        : sort === 'replies'
          ? { comments: { _count: 'desc' } }
          : [{ isStickied: 'desc' }, { createdAt: 'desc' }];

    const posts = await prisma.forumPost.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, avatar: true } },
        _count: { select: { comments: true, reactions: true } }
      },
      orderBy
    });

    const list = posts.map((p) => ({
      id: p.id,
      title: p.title,
      excerpt: p.content.slice(0, 200) + (p.content.length > 200 ? '...' : ''),
      category: p.category,
      categoryLabel: CATEGORIES[p.category] || p.category,
      tags: p.tags,
      isStickied: p.isStickied,
      author: p.user.username,
      authorId: p.user.id,
      authorAvatar: p.user.avatar || '💬',
      replies: p._count.comments,
      upvotes: p._count.reactions,
      lastActivity: p.updatedAt,
      createdAt: p.createdAt
    }));

    return res.json({ success: true, posts: list });
  } catch (error) {
    console.error('Forum listPosts error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load posts' });
  }
};

// Create post (auth required)
export const createPost = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

    const { title, content, category, tags } = req.body;
    if (!title?.trim() || !content?.trim() || !category?.trim()) {
      return res.status(400).json({ success: false, message: 'Title, content, and category are required' });
    }

    const post = await prisma.forumPost.create({
      data: {
        userId,
        title: title.trim(),
        content: content.trim(),
        category: category.trim(),
        tags: Array.isArray(tags) ? tags : tags ? [tags] : []
      },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
        _count: { select: { comments: true, reactions: true } }
      }
    });

    return res.status(201).json({
      success: true,
      post: {
        id: post.id,
        title: post.title,
        excerpt: post.content.slice(0, 200) + (post.content.length > 200 ? '...' : ''),
        category: post.category,
        categoryLabel: CATEGORIES[post.category] || post.category,
        tags: post.tags,
        isStickied: post.isStickied,
        author: post.user.username,
        authorId: post.user.id,
        authorAvatar: post.user.avatar || '💬',
        replies: 0,
        upvotes: 0,
        lastActivity: post.updatedAt,
        createdAt: post.createdAt
      }
    });
  } catch (error) {
    console.error('Forum createPost error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create post' });
  }
};

// Get single post with nested comments and reaction state for current user
export const getPost = async (req: Request, res: Response) => {
  try {
    const postId = req.params.id;
    const userId = (req as any).userId;

    const post = await prisma.forumPost.findUnique({
      where: { id: postId },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
        comments: {
          include: {
            user: { select: { id: true, username: true, avatar: true } },
            reactions: true,
            _count: { select: { reactions: true } }
          },
          orderBy: { createdAt: 'asc' }
        },
        reactions: true,
        _count: { select: { comments: true, reactions: true } }
      }
    });

    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    // Build comment tree: top-level have parentId null, replies have parentId set
    const commentMap = new Map<string, any>();
    post.comments.forEach((c) => {
      commentMap.set(c.id, {
        id: c.id,
        author: c.user.username,
        authorId: c.user.id,
        authorAvatar: c.user.avatar || '💬',
        authorLevel: 'Member',
        content: c.content,
        createdAt: c.createdAt,
        upvotes: c._count.reactions,
        userLiked: userId ? c.reactions.some((r) => r.userId === userId) : false,
        replies: []
      });
    });

    const topLevel: any[] = [];
    post.comments.forEach((c) => {
      const node = commentMap.get(c.id)!;
      if (!c.parentId) {
        topLevel.push(node);
      } else {
        const parent = commentMap.get(c.parentId);
        if (parent) parent.replies.push(node);
        else topLevel.push(node);
      }
    });

    const userLikedPost = userId ? post.reactions.some((r) => r.userId === userId) : false;

    return res.json({
      success: true,
      post: {
        id: post.id,
        title: post.title,
        content: post.content,
        category: post.category,
        categoryLabel: CATEGORIES[post.category] || post.category,
        tags: post.tags,
        isStickied: post.isStickied,
        author: post.user.username,
        authorId: post.user.id,
        authorAvatar: post.user.avatar || '💬',
        authorLevel: 'Member',
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        upvotes: post._count.reactions,
        userLiked: userLikedPost,
        comments: topLevel,
        replyCount: post._count.comments
      }
    });
  } catch (error) {
    console.error('Forum getPost error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load post' });
  }
};

// Toggle heart on post
export const reactPost = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

    const postId = req.params.id;
    const existing = await prisma.forumPostReaction.findUnique({
      where: { postId_userId: { postId, userId } }
    });

    if (existing) {
      await prisma.forumPostReaction.delete({
        where: { postId_userId: { postId, userId } }
      });
      const count = await prisma.forumPostReaction.count({ where: { postId } });
      return res.json({ success: true, liked: false, count });
    } else {
      await prisma.forumPostReaction.create({
        data: { postId, userId, type: 'heart' }
      });
      const count = await prisma.forumPostReaction.count({ where: { postId } });
      return res.json({ success: true, liked: true, count });
    }
  } catch (error) {
    console.error('Forum reactPost error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update reaction' });
  }
};

// Add comment or reply (parentId = comment id for reply)
export const addComment = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

    const postId = req.params.id;
    const { content, parentId } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ success: false, message: 'Content is required' });
    }

    const post = await prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const comment = await prisma.forumComment.create({
      data: {
        postId,
        userId,
        parentId: parentId || null,
        content: content.trim()
      },
      include: {
        user: { select: { id: true, username: true, avatar: true } }
      }
    });

    return res.status(201).json({
      success: true,
      comment: {
        id: comment.id,
        author: comment.user.username,
        authorId: comment.user.id,
        authorAvatar: comment.user.avatar || '💬',
        authorLevel: 'Member',
        content: comment.content,
        createdAt: comment.createdAt,
        upvotes: 0,
        userLiked: false,
        replies: [],
        parentId: comment.parentId
      }
    });
  } catch (error) {
    console.error('Forum addComment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to add comment' });
  }
};

// Toggle heart on comment
export const reactComment = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

    const commentId = req.params.id;
    const existing = await prisma.forumCommentReaction.findUnique({
      where: { commentId_userId: { commentId, userId } }
    });

    if (existing) {
      await prisma.forumCommentReaction.delete({
        where: { commentId_userId: { commentId, userId } }
      });
      const count = await prisma.forumCommentReaction.count({ where: { commentId } });
      return res.json({ success: true, liked: false, count });
    } else {
      await prisma.forumCommentReaction.create({
        data: { commentId, userId, type: 'heart' }
      });
      const count = await prisma.forumCommentReaction.count({ where: { commentId } });
      return res.json({ success: true, liked: true, count });
    }
  } catch (error) {
    console.error('Forum reactComment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update reaction' });
  }
};
