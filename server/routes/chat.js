const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get or create default group
router.get('/groups', authMiddleware, async (req, res) => {
  try {
    let group = await prisma.group.findFirst({
      where: { name: 'Fun Friday Group' }
    });

    if (!group) {
      group = await prisma.group.create({
        data: {
          name: 'Fun Friday Group',
          description: 'Anonymous chat group for Friday fun!',
          isAnonymous: true
        }
      });
    }

    // Join user to group if not already a member
    const membership = await prisma.groupMember.findFirst({
      where: {
        userId: req.userId,
        groupId: group.id
      }
    });

    if (!membership) {
      await prisma.groupMember.create({
        data: {
          userId: req.userId,
          groupId: group.id
        }
      });
    }

    res.json({ success: true, group });

  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages for a group
router.get('/groups/:groupId/messages', authMiddleware, async (req, res) => {
  try {
    const { groupId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await prisma.message.findMany({
      where: { groupId },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    res.json({
      success: true,
      messages: messages.reverse(), // Reverse to get chronological order
      pagination: {
        page,
        limit,
        hasMore: messages.length === limit
      }
    });

  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send message
router.post('/groups/:groupId/messages', authMiddleware, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { content, type = 'TEXT' } = req.body;

    const message = await prisma.message.create({
      data: {
        content,
        type,
        senderId: req.userId,
        groupId
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      }
    });

    res.json({ success: true, message });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get group members
router.get('/groups/:groupId/members', authMiddleware, async (req, res) => {
  try {
    const { groupId } = req.params;

    const members = await prisma.groupMember.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            isOnline: true
          }
        }
      }
    });

    res.json({
      success: true,
      members: members.map(member => member.user)
    });

  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;