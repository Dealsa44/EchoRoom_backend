import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import ResendEmailService from '../services/resendEmailService';
import { generateVerificationCode, validateEmail } from '../utils/validation';

const prisma = new PrismaClient();
const emailService = new ResendEmailService();

// Types
interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  dateOfBirth: string;
  location: string;
  hometown?: string;
  relationshipStatus?: string;
  languages?: Array<{
    code: string;
    name: string;
    proficiency: string;
  }>;
  interests?: string[];
  genderIdentity?: string;
  orientation?: string;
  customGender?: string;
  customOrientation?: string;
  ethnicity?: string;
  lookingForRelationship?: boolean;
  lookingForFriendship?: boolean;
  relationshipType?: string;
  smoking?: string;
  drinking?: string;
  hasChildren?: string;
  education?: string;
  occupation?: string;
  religion?: string;
  politicalViews?: string;
  about?: string;
  chatStyle?: string;
  photos?: string[];
}

interface LoginRequest {
  email: string;
  password: string;
}

interface VerifyEmailRequest {
  email: string;
  code: string;
}

// Generate JWT token
const generateToken = (userId: string): string => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
};

// Send verification code
export const sendVerificationCode = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || !validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required'
      });
    }

    // Check if email is already registered
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email is already registered'
      });
    }

    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + parseInt(process.env.VERIFICATION_CODE_EXPIRY || '600000'));

    console.log('📧 Generated verification code:', { email, code, expiresAt });

    // Store or update verification code
    const verificationRecord = await prisma.verificationCode.upsert({
      where: { email },
      update: { code, expiresAt },
      create: { email, code, expiresAt }
    });

    console.log('💾 Stored verification code:', verificationRecord);

    // Send email and only return success if it was actually sent
    const sent = await emailService.sendVerificationEmail(email, code);
    if (!sent) {
      return res.status(503).json({
        success: false,
        message: 'Failed to send verification email. Please try again.'
      });
    }

    return res.json({
      success: true,
      message: 'Verification code sent to your email'
    });

  } catch (error) {
    console.error('Send verification code error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send verification code'
    });
  }
};

// Verify email code
export const verifyEmailCode = async (req: Request, res: Response) => {
  try {
    const { email, code }: VerifyEmailRequest = req.body;

    console.log('🔍 Verifying email code:', { email, code });

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and code are required'
      });
    }

    // Find verification code
    const verification = await prisma.verificationCode.findUnique({
      where: { email }
    });

    console.log('📋 Found verification record:', verification);

    if (!verification) {
      console.log('❌ No verification code found for email:', email);
      return res.status(400).json({
        success: false,
        message: 'No verification code found for this email'
      });
    }

    // Check if code is expired
    if (verification.expiresAt < new Date()) {
      console.log('⏰ Verification code expired for email:', email);
      await prisma.verificationCode.delete({
        where: { email }
      });
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired'
      });
    }

    // Check if code matches
    console.log('🔐 Comparing codes:', { stored: verification.code, received: code, match: verification.code === code });
    if (verification.code !== code) {
      console.log('❌ Code mismatch for email:', email);
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    console.log('✅ Code verified successfully for email:', email);

    // Code is valid - delete it (user will be created during registration)
    await prisma.verificationCode.delete({
      where: { email }
    });

    console.log('🎉 Email verification completed successfully for:', email);

    return res.json({
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    console.error('Verify email code error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify email code'
    });
  }
};

// Register user
export const registerUser = async (req: Request, res: Response) => {
  try {
    const data: RegisterRequest = req.body;

    // Validate required fields
    if (!data.username || !data.email || !data.password || !data.dateOfBirth || !data.location) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, password, date of birth, and location are required'
      });
    }

    // Validate email format
    if (!validateEmail(data.email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { username: data.username }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === data.email ? 'Email already registered' : 'Username already taken'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        password: hashedPassword,
        dateOfBirth: data.dateOfBirth,
        location: data.location,
        hometown: data.hometown,
        relationshipStatus: data.relationshipStatus,
        genderIdentity: data.genderIdentity,
        orientation: data.orientation,
        customGender: data.customGender,
        customOrientation: data.customOrientation,
        ethnicity: data.ethnicity,
        lookingForRelationship: data.lookingForRelationship || false,
        lookingForFriendship: data.lookingForFriendship || false,
        relationshipType: data.relationshipType,
        smoking: data.smoking,
        drinking: data.drinking,
        hasChildren: data.hasChildren,
        education: data.education,
        occupation: data.occupation,
        religion: data.religion,
        politicalViews: data.politicalViews,
        about: data.about,
        chatStyle: data.chatStyle,
        photos: data.photos || [],
        emailVerified: true // Email is already verified at this point
      }
    });

    // Create languages if provided
    if (data.languages && data.languages.length > 0) {
      await prisma.userLanguage.createMany({
        data: data.languages.map(lang => ({
          userId: user.id,
          code: lang.code,
          name: lang.name,
          proficiency: lang.proficiency
        }))
      });
    }

    // Create interests if provided
    if (data.interests && data.interests.length > 0) {
      await prisma.userInterest.createMany({
        data: data.interests.map(interest => ({
          userId: user.id,
          interest
        }))
      });
    }

    // Generate JWT token since user is fully registered and verified
    const token = generateToken(user.id);

    // Return success with token - user is fully registered and verified
    const { password, ...userWithoutPassword } = user;

    return res.status(201).json({
      success: true,
      message: 'Registration completed successfully',
      user: userWithoutPassword,
      token
    });

  } catch (error) {
    console.error('Register user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register user'
    });
  }
};

// Login user
export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password }: LoginRequest = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        languages: true,
        interests: true,
        profileQuestions: true
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = generateToken(user.id);

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = user;

    // Transform interests from objects to strings for frontend compatibility
    const transformedUser = {
      ...userWithoutPassword,
      interests: userWithoutPassword.interests?.map(interest => interest.interest) || []
    };

    return res.json({
      success: true,
      message: 'Login successful',
      user: transformedUser,
      token
    });

  } catch (error) {
    console.error('Login user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to login'
    });
  }
};

// Logout user (client-side token removal)
export const logoutUser = async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
};

// Get current user
export const getCurrentUser = async (req: Request, res: Response) => {
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
    console.error('Get current user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user data'
    });
  }
};
