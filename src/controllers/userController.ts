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

    // Extract languages and interests for separate handling
    const { languages, interests, profileQuestions, ...userUpdateData } = updateData;

    // Start a transaction to update user and related data
    const result = await prisma.$transaction(async (tx) => {
      // Update main user data
      const user = await tx.user.update({
        where: { id: userId },
        data: userUpdateData,
        include: {
          languages: true,
          interests: true,
          profileQuestions: true
        }
      });

      // Update languages if provided
      if (languages && Array.isArray(languages)) {
        // Delete existing languages
        await tx.userLanguage.deleteMany({
          where: { userId }
        });

        // Add new languages
        if (languages.length > 0) {
          await tx.userLanguage.createMany({
            data: languages.map((lang: any) => ({
              userId,
              code: lang.language || lang.code,
              name: lang.name || (lang.language || lang.code),
              proficiency: lang.level || lang.proficiency
            }))
          });
        }
      }

      // Update interests if provided
      if (interests && Array.isArray(interests)) {
        // Delete existing interests
        await tx.userInterest.deleteMany({
          where: { userId }
        });

        // Add new interests
        if (interests.length > 0) {
          await tx.userInterest.createMany({
            data: interests.map((interest: any) => ({
              userId,
              interest: typeof interest === 'string' ? interest : interest.interest
            }))
          });
        }
      }

      // Update profile questions if provided
      if (profileQuestions && Array.isArray(profileQuestions)) {
        // Delete existing profile questions
        await tx.userProfileQuestion.deleteMany({
          where: { userId }
        });

        // Add new profile questions
        if (profileQuestions.length > 0) {
          await tx.userProfileQuestion.createMany({
            data: profileQuestions.map((question: any) => ({
              userId,
              question: question.question,
              answer: question.answer
            }))
          });
        }
      }

      // Fetch updated user with all relations
      return await tx.user.findUnique({
        where: { id: userId },
        include: {
          languages: true,
          interests: true,
          profileQuestions: true
        }
      });
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const { password, ...userWithoutPassword } = result;

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
