import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get user profile
export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        languages: true,
        interests: true,
        profileQuestions: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const { password, ...userWithoutPassword } = user;

    // Transform interests from objects to strings for frontend compatibility
    const transformedUser = {
      ...userWithoutPassword,
      interests: userWithoutPassword.interests?.map(interest => interest.interest) || []
    };

    return res.json({
      success: true,
      user: transformedUser
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
};

// Update user profile
export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const updateData = req.body;

    // Remove sensitive fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.email;
    delete updateData.password;
    delete updateData.emailVerified;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        languages: true,
        interests: true,
        profileQuestions: true
      }
    });

    const { password, ...userWithoutPassword } = user;

    // Transform interests from objects to strings for frontend compatibility
    const transformedUser = {
      ...userWithoutPassword,
      interests: userWithoutPassword.interests?.map(interest => interest.interest) || []
    };

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user: transformedUser
    });

  } catch (error) {
    console.error('Update user profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

// Search users
export const searchUsers = async (req: Request, res: Response) => {
  try {
    const { query, limit = 20, offset = 0 } = req.query;
    const userId = (req as any).userId;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: userId } }, // Exclude current user
          {
            OR: [
              { username: { contains: query, mode: 'insensitive' } },
              { bio: { contains: query, mode: 'insensitive' } },
              { about: { contains: query, mode: 'insensitive' } }
            ]
          }
        ]
      },
      select: {
        id: true,
        username: true,
        avatar: true,
        bio: true,
        location: true,
        dateOfBirth: true,
        interests: true,
        languages: true,
        createdAt: true
      },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      orderBy: { createdAt: 'desc' }
    });

    return res.json({
      success: true,
      users,
      total: users.length
    });

  } catch (error) {
    console.error('Search users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search users'
    });
  }
};
