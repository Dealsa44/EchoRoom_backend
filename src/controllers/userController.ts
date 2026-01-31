import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { isCompatible } from '../utils/attractionPreferences';

const prisma = new PrismaClient();

function ageFromDateOfBirth(dateOfBirth: string | null | undefined): number {
  if (!dateOfBirth) return 0;
  const birth = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

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

// Get discover feed: other users compatible with current user (for Match page)
export const getDiscoverUsers = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).userId;

    const me = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        genderIdentity: true,
        orientation: true,
        lookingForRelationship: true,
        lookingForFriendship: true
      }
    });
    if (!me) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const others = await prisma.user.findMany({
      where: { id: { not: currentUserId } },
      include: {
        languages: true,
        interests: true
      }
    });

    const compatible = others.filter((u) =>
      isCompatible(
        me.genderIdentity,
        me.orientation,
        me.lookingForRelationship,
        me.lookingForFriendship,
        u.genderIdentity,
        u.orientation,
        u.lookingForRelationship ?? false,
        u.lookingForFriendship ?? false
      )
    );

    const list = compatible.map((u) => ({
      id: u.id,
      name: u.username,
      avatar: u.avatar ?? '',
      age: ageFromDateOfBirth(u.dateOfBirth),
      location: u.location ?? '',
      hometown: u.hometown ?? undefined,
      relationshipStatus: u.relationshipStatus ?? undefined,
      distance: 0,
      bio: u.bio ?? '',
      about: u.about ?? '',
      interests: u.interests?.map((i) => i.interest) ?? [],
      languages: (u.languages ?? []).map((l) => ({ language: l.code, level: l.proficiency })),
      languageLevel: 'intermediate',
      chatStyle: (u.chatStyle as 'introvert' | 'ambievert' | 'extrovert') ?? 'ambievert',
      lastActive: '',
      isOnline: false,
      sharedInterests: 0,
      genderIdentity: u.genderIdentity ?? '',
      orientation: u.orientation ?? '',
      ethnicity: u.ethnicity ?? '',
      lookingForRelationship: u.lookingForRelationship ?? false,
      lookingForFriendship: u.lookingForFriendship ?? false,
      relationshipType: u.relationshipType ?? undefined,
      smoking: (u.smoking as any) ?? 'prefer-not-to-say',
      drinking: (u.drinking as any) ?? 'prefer-not-to-say',
      hasChildren: (u.hasChildren as any) ?? 'prefer-not-to-say',
      education: (u.education as any) ?? 'prefer-not-to-say',
      occupation: u.occupation ?? '',
      religion: (u.religion as any) ?? 'prefer-not-to-say',
      politicalViews: (u.politicalViews as any) ?? 'prefer-not-to-say',
      photos: Array.isArray(u.photos) ? u.photos : (u.photos ? [u.photos] : []),
      isVerified: !!u.emailVerified,
      profileCompletion: 80,
      iceBreakerAnswers: {} as Record<string, string>,
      profileQuestions: []
    }));

    return res.json({ success: true, users: list });
  } catch (error) {
    console.error('Discover users error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load discover feed' });
  }
};

// Get public profile by id (for viewing another user's profile)
export const getPublicProfile = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).userId;
    const { id: targetId } = req.params;
    if (!targetId) {
      return res.status(400).json({ success: false, message: 'User id required' });
    }
    if (targetId === currentUserId) {
      return res.status(400).json({ success: false, message: 'Use your own profile endpoint' });
    }

    const u = await prisma.user.findUnique({
      where: { id: targetId },
      include: { languages: true, interests: true, profileQuestions: true }
    });
    if (!u) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const profile = {
      id: u.id,
      name: u.username,
      avatar: u.avatar ?? '',
      age: ageFromDateOfBirth(u.dateOfBirth),
      location: u.location ?? '',
      hometown: u.hometown ?? undefined,
      relationshipStatus: u.relationshipStatus ?? undefined,
      distance: 0,
      bio: u.bio ?? '',
      about: u.about ?? '',
      interests: u.interests?.map((i) => i.interest) ?? [],
      languages: (u.languages ?? []).map((l) => ({ language: l.code, level: l.proficiency })),
      languageLevel: 'intermediate',
      chatStyle: (u.chatStyle as 'introvert' | 'ambievert' | 'extrovert') ?? 'ambievert',
      lastActive: '',
      isOnline: false,
      sharedInterests: 0,
      genderIdentity: u.genderIdentity ?? '',
      orientation: u.orientation ?? '',
      ethnicity: u.ethnicity ?? '',
      lookingForRelationship: u.lookingForRelationship ?? false,
      lookingForFriendship: u.lookingForFriendship ?? false,
      relationshipType: u.relationshipType ?? undefined,
      smoking: (u.smoking as any) ?? 'prefer-not-to-say',
      drinking: (u.drinking as any) ?? 'prefer-not-to-say',
      hasChildren: (u.hasChildren as any) ?? 'prefer-not-to-say',
      education: (u.education as any) ?? 'prefer-not-to-say',
      occupation: u.occupation ?? '',
      religion: (u.religion as any) ?? 'prefer-not-to-say',
      politicalViews: (u.politicalViews as any) ?? 'prefer-not-to-say',
      photos: Array.isArray(u.photos) ? u.photos : (u.photos ? [u.photos] : []),
      isVerified: !!u.emailVerified,
      profileCompletion: 80,
      iceBreakerAnswers: {} as Record<string, string>,
      profileQuestions: (u.profileQuestions ?? []).map((q) => ({
        id: q.id,
        question: q.question,
        category: 'casual' as const,
        answer: q.answer ?? undefined
      }))
    };

    return res.json({ success: true, profile });
  } catch (error) {
    console.error('Get public profile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load profile' });
  }
};
