const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class AuthController {
  // Generate JWT token
  generateToken(userId) {
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  }

  // Validate email format
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate password strength
  isValidPassword(password) {
    return password && password.length >= 6;
  }

  // Register new user
  async register(req, res) {
    try {
      const { username, email, password } = req.body;

      // Validation
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username and password are required'
        });
      }

      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({
          success: false,
          error: 'Username must be between 3 and 20 characters'
        });
      }

      if (!this.isValidPassword(password)) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 6 characters long'
        });
      }

      if (email && !this.isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid email address'
        });
      }

      // Check if username already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { username: username.toLowerCase() },
            ...(email ? [{ email: email.toLowerCase() }] : [])
          ]
        }
      });

      if (existingUser) {
        const field = existingUser.username.toLowerCase() === username.toLowerCase() 
          ? 'Username' 
          : 'Email';
        return res.status(409).json({
          success: false,
          error: `${field} already exists`
        });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user
      const user = await prisma.user.create({
        data: {
          username: username.toLowerCase(),
          email: email ? email.toLowerCase() : null,
          password: hashedPassword,
          avatar: this.generateAvatarUrl(username)
        },
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
          createdAt: true,
          isOnline: true
        }
      });

      // Generate JWT token
      const token = this.generateToken(user.id);

      // Log registration
      console.log(`New user registered: ${user.username} (${user.id})`);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        token,
        user: {
          ...user,
          username: username // Return original case
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      
      // Handle specific Prisma errors
      if (error.code === 'P2002') {
        return res.status(409).json({
          success: false,
          error: 'Username or email already exists'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error during registration'
      });
    }
  }

  // Login user
  async login(req, res) {
    try {
      const { username, password } = req.body;

      // Validation
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username and password are required'
        });
      }

      // Find user (case-insensitive)
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: username.toLowerCase() },
            { email: username.toLowerCase() }
          ]
        }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid username or password'
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid username or password'
        });
      }

      // Update user online status
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          isOnline: true,
          updatedAt: new Date()
        }
      });

      // Generate JWT token
      const token = this.generateToken(user.id);

      // Log login
      console.log(`User logged in: ${user.username} (${user.id})`);

      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          isOnline: true,
          createdAt: user.createdAt
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during login'
      });
    }
  }

  // Anonymous login
  async anonymousLogin(req, res) {
    try {
      // Generate unique anonymous username
      const timestamp = Date.now().toString().slice(-6);
      const randomNum = Math.floor(Math.random() * 999);
      const anonymousUsername = `Anonymous${timestamp}${randomNum}`;
      
      // Generate random password for security
      const randomPassword = Math.random().toString(36).substring(2, 15) + 
                           Math.random().toString(36).substring(2, 15);
      
      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(randomPassword, saltRounds);

      // Create anonymous user
      const user = await prisma.user.create({
        data: {
          username: anonymousUsername,
          password: hashedPassword,
          avatar: this.generateAvatarUrl(anonymousUsername),
          isOnline: true
        },
        select: {
          id: true,
          username: true,
          avatar: true,
          isOnline: true,
          createdAt: true
        }
      });

      // Generate JWT token
      const token = this.generateToken(user.id);

      // Log anonymous login
      console.log(`Anonymous user created: ${user.username} (${user.id})`);

      res.json({
        success: true,
        message: 'Anonymous login successful',
        token,
        user
      });

    } catch (error) {
      console.error('Anonymous login error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during anonymous login'
      });
    }
  }

  // Logout user
  async logout(req, res) {
    try {
      const userId = req.userId;

      // Update user offline status
      await prisma.user.update({
        where: { id: userId },
        data: { 
          isOnline: false,
          updatedAt: new Date()
        }
      });

      // Log logout
      console.log(`User logged out: ${userId}`);

      res.json({
        success: true,
        message: 'Logout successful'
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during logout'
      });
    }
  }

  // Verify token and get user info
  async verifyToken(req, res) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
          isOnline: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        user
      });

    } catch (error) {
      console.error('Token verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during token verification'
      });
    }
  }

  // Refresh token
  async refreshToken(req, res) {
    try {
      const userId = req.userId;
      const newToken = this.generateToken(userId);

      res.json({
        success: true,
        token: newToken,
        message: 'Token refreshed successfully'
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during token refresh'
      });
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      const userId = req.userId;
      const { username, email } = req.body;
      const updateData = {};

      // Validate and prepare username update
      if (username !== undefined) {
        if (!username || username.length < 3 || username.length > 20) {
          return res.status(400).json({
            success: false,
            error: 'Username must be between 3 and 20 characters'
          });
        }

        // Check if username is already taken
        const existingUser = await prisma.user.findFirst({
          where: {
            username: username.toLowerCase(),
            NOT: { id: userId }
          }
        });

        if (existingUser) {
          return res.status(409).json({
            success: false,
            error: 'Username already exists'
          });
        }

        updateData.username = username.toLowerCase();
        updateData.avatar = this.generateAvatarUrl(username);
      }

      // Validate and prepare email update
      if (email !== undefined) {
        if (email && !this.isValidEmail(email)) {
          return res.status(400).json({
            success: false,
            error: 'Please provide a valid email address'
          });
        }

        if (email) {
          // Check if email is already taken
          const existingUser = await prisma.user.findFirst({
            where: {
              email: email.toLowerCase(),
              NOT: { id: userId }
            }
          });

          if (existingUser) {
            return res.status(409).json({
              success: false,
              error: 'Email already exists'
            });
          }
        }

        updateData.email = email ? email.toLowerCase() : null;
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...updateData,
          updatedAt: new Date()
        },
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
          isOnline: true,
          createdAt: true,
          updatedAt: true
        }
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: updatedUser
      });

    } catch (error) {
      console.error('Profile update error:', error);
      
      if (error.code === 'P2002') {
        return res.status(409).json({
          success: false,
          error: 'Username or email already exists'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error during profile update'
      });
    }
  }

  // Generate avatar URL (you can integrate with services like Gravatar, etc.)
  generateAvatarUrl(username) {
    // Simple color-based avatar generation
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    
    const colorIndex = username.length % colors.length;
    const color = colors[colorIndex].replace('#', '');
    
    // Using UI Avatars service for generated avatars
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=${color}&color=fff&size=128&bold=true`;
  }

  // Clean up anonymous users (can be called periodically)
  async cleanupAnonymousUsers(req, res) {
    try {
      // Delete anonymous users older than 24 hours who are offline
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const deletedUsers = await prisma.user.deleteMany({
        where: {
          username: {
            startsWith: 'Anonymous'
          },
          isOnline: false,
          updatedAt: {
            lt: twentyFourHoursAgo
          }
        }
      });

      res.json({
        success: true,
        message: `Cleaned up ${deletedUsers.count} anonymous users`
      });

    } catch (error) {
      console.error('Cleanup error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during cleanup'
      });
    }
  }
}

module.exports = new AuthController();