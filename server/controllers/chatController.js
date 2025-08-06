const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class ChatController {
  // Get all groups for a user
  async getGroups(req, res) {
    try {
      const userId = req.userId;

      // Get groups where user is a member
      const userGroups = await prisma.groupMember.findMany({
        where: { userId },
        include: {
          group: {
            include: {
              _count: {
                select: {
                  members: true,
                  messages: true
                }
              },
              messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: {
                  sender: {
                    select: {
                      id: true,
                      username: true,
                      avatar: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: {
          joinedAt: 'desc'
        }
      });

      const groups = userGroups.map(membership => ({
        ...membership.group,
        memberCount: membership.group._count.members,
        messageCount: membership.group._count.messages,
        lastMessage: membership.group.messages[0] || null,
        joinedAt: membership.joinedAt
      }));

      res.json({
        success: true,
        groups
      });

    } catch (error) {
      console.error('Error fetching groups:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while fetching groups'
      });
    }
  }

  // Get or create default group
  async getDefaultGroup(req, res) {
    try {
      const userId = req.userId;
      
      // Try to find existing default group
      let group = await prisma.group.findFirst({
        where: { name: 'Fun Friday Group' },
        include: {
          _count: {
            select: {
              members: true,
              messages: true
            }
          }
        }
      });

      // Create default group if it doesn't exist
      if (!group) {
        group = await prisma.group.create({
          data: {
            name: 'Fun Friday Group',
            description: 'Anonymous chat group for Friday fun! 🎉',
            isAnonymous: true
          },
          include: {
            _count: {
              select: {
                members: true,
                messages: true
              }
            }
          }
        });

        console.log(`Created default group: ${group.name} (${group.id})`);
      }

      // Check if user is already a member
      const existingMembership = await prisma.groupMember.findFirst({
        where: {
          userId,
          groupId: group.id
        }
      });

      // Add user to group if not already a member
      if (!existingMembership) {
        await prisma.groupMember.create({
          data: {
            userId,
            groupId: group.id
          }
        });

        console.log(`User ${userId} joined group ${group.id}`);
      }

      res.json({
        success: true,
        group: {
          ...group,
          memberCount: group._count.members + (existingMembership ? 0 : 1),
          messageCount: group._count.messages
        }
      });

    } catch (error) {
      console.error('Error getting default group:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while getting default group'
      });
    }
  }

  // Create a new group
  async createGroup(req, res) {
    try {
      const userId = req.userId;
      const { name, description, isAnonymous = true } = req.body;

      // Validation
      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Group name is required'
        });
      }

      if (name.length > 50) {
        return res.status(400).json({
          success: false,
          error: 'Group name must be less than 50 characters'
        });
      }

      if (description && description.length > 200) {
        return res.status(400).json({
          success: false,
          error: 'Group description must be less than 200 characters'
        });
      }

      // Check if group name already exists
      const existingGroup = await prisma.group.findFirst({
        where: { name: name.trim() }
      });

      if (existingGroup) {
        return res.status(409).json({
          success: false,
          error: 'Group name already exists'
        });
      }

      // Create group
      const group = await prisma.group.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          isAnonymous: Boolean(isAnonymous)
        }
      });

      // Add creator as first member
      await prisma.groupMember.create({
        data: {
          userId,
          groupId: group.id
        }
      });

      console.log(`New group created: ${group.name} (${group.id}) by user ${userId}`);

      res.status(201).json({
        success: true,
        message: 'Group created successfully',
        group: {
          ...group,
          memberCount: 1,
          messageCount: 0
        }
      });

    } catch (error) {
      console.error('Error creating group:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while creating group'
      });
    }
  }

  // Join a group
  async joinGroup(req, res) {
    try {
      const userId = req.userId;
      const { groupId } = req.params;

      // Check if group exists
      const group = await prisma.group.findUnique({
        where: { id: groupId }
      });

      if (!group) {
        return res.status(404).json({
          success: false,
          error: 'Group not found'
        });
      }

      // Check if user is already a member
      const existingMembership = await prisma.groupMember.findFirst({
        where: {
          userId,
          groupId
        }
      });

      if (existingMembership) {
        return res.status(409).json({
          success: false,
          error: 'Already a member of this group'
        });
      }

      // Add user to group
      await prisma.groupMember.create({
        data: {
          userId,
          groupId
        }
      });

      console.log(`User ${userId} joined group ${groupId}`);

      res.json({
        success: true,
        message: 'Successfully joined the group',
        group
      });

    } catch (error) {
      console.error('Error joining group:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while joining group'
      });
    }
  }

  // Leave a group
  async leaveGroup(req, res) {
    try {
      const userId = req.userId;
      const { groupId } = req.params;

      // Check if user is a member
      const membership = await prisma.groupMember.findFirst({
        where: {
          userId,
          groupId
        }
      });

      if (!membership) {
        return res.status(404).json({
          success: false,
          error: 'Not a member of this group'
        });
      }

      // Remove user from group
      await prisma.groupMember.delete({
        where: {
          id: membership.id
        }
      });

      console.log(`User ${userId} left group ${groupId}`);

      res.json({
        success: true,
        message: 'Successfully left the group'
      });

    } catch (error) {
      console.error('Error leaving group:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while leaving group'
      });
    }
  }

  // Get messages for a group
  async getMessages(req, res) {
    try {
      const userId = req.userId;
      const { groupId } = req.params;
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
      const skip = (page - 1) * limit;

      // Check if user is a member of the group
      const membership = await prisma.groupMember.findFirst({
        where: {
          userId,
          groupId
        }
      });

      if (!membership) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You are not a member of this group.'
        });
      }

      // Get total message count
      const totalMessages = await prisma.message.count({
        where: { groupId }
      });

      // Get messages with pagination
      const messages = await prisma.message.findMany({
        where: { groupId },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              avatar: true,
              isOnline: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      });

      const totalPages = Math.ceil(totalMessages / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      res.json({
        success: true,
        messages: messages.reverse(), // Reverse to get chronological order
        pagination: {
          page,
          limit,
          totalMessages,
          totalPages,
          hasNextPage,
          hasPrevPage
        }
      });

    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while fetching messages'
      });
    }
  }

  // Send a message
  async sendMessage(req, res) {
    try {
      const userId = req.userId;
      const { groupId } = req.params;
      const { content, type = 'TEXT' } = req.body;

      // Validation
      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Message content is required'
        });
      }

      if (content.length > 1000) {
        return res.status(400).json({
          success: false,
          error: 'Message must be less than 1000 characters'
        });
      }

      const validTypes = ['TEXT', 'IMAGE', 'FILE', 'SYSTEM'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid message type'
        });
      }

      // Check if user is a member of the group
      const membership = await prisma.groupMember.findFirst({
        where: {
          userId,
          groupId
        }
      });

      if (!membership) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You are not a member of this group.'
        });
      }

      // Create message
      const message = await prisma.message.create({
        data: {
          content: content.trim(),
          type,
          senderId: userId,
          groupId
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              avatar: true,
              isOnline: true
            }
          }
        }
      });

      console.log(`Message sent by ${userId} in group ${groupId}`);

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: message
      });

    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while sending message'
      });
    }
  }

  // Delete a message
  async deleteMessage(req, res) {
    try {
      const userId = req.userId;
      const { messageId } = req.params;

      // Find the message
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: {
          sender: true
        }
      });

      if (!message) {
        return res.status(404).json({
          success: false,
          error: 'Message not found'
        });
      }

      // Check if user is the sender
      if (message.senderId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only delete your own messages.'
        });
      }

      // Delete the message
      await prisma.message.delete({
        where: { id: messageId }
      });

      console.log(`Message ${messageId} deleted by user ${userId}`);

      res.json({
        success: true,
        message: 'Message deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while deleting message'
      });
    }
  }

  // Get group members
  async getGroupMembers(req, res) {
    try {
      const userId = req.userId;
      const { groupId } = req.params;

      // Check if user is a member of the group
      const membership = await prisma.groupMember.findFirst({
        where: {
          userId,
          groupId
        }
      });

      if (!membership) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You are not a member of this group.'
        });
      }

      // Get all group members
      const members = await prisma.groupMember.findMany({
        where: { groupId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatar: true,
              isOnline: true,
              createdAt: true
            }
          }
        },
        orderBy: {
          joinedAt: 'asc'
        }
      });

      const memberList = members.map(member => ({
        ...member.user,
        joinedAt: member.joinedAt
      }));

      res.json({
        success: true,
        members: memberList,
        totalMembers: memberList.length
      });

    } catch (error) {
      console.error('Error fetching group members:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while fetching group members'
      });
    }
  }

  // Get group info
  async getGroupInfo(req, res) {
    try {
      const userId = req.userId;
      const { groupId } = req.params;

      // Check if user is a member of the group
      const membership = await prisma.groupMember.findFirst({
        where: {
          userId,
          groupId
        }
      });

      if (!membership) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You are not a member of this group.'
        });
      }

      // Get group with counts
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          _count: {
            select: {
              members: true,
              messages: true
            }
          }
        }
      });

      if (!group) {
        return res.status(404).json({
          success: false,
          error: 'Group not found'
        });
      }

      res.json({
        success: true,
        group: {
          ...group,
          memberCount: group._count.members,
          messageCount: group._count.messages,
          userJoinedAt: membership.joinedAt
        }
      });

    } catch (error) {
      console.error('Error fetching group info:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while fetching group info'
      });
    }
  }

  // Search messages in a group
  // Search messages in a group
async searchMessages(req, res) {
  try {
    const userId = req.userId;
    const { groupId } = req.params;
    const { query, page = 1, limit = 20 } = req.query;

    // Validate query
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    if (query.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be less than 100 characters'
      });
    }

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Check if user is a member of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        userId,
        groupId
      }
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You are not a member of this group.'
      });
    }

    // Search messages with case-insensitive partial match
    const totalMessages = await prisma.message.count({
      where: {
        groupId,
        content: {
          contains: query.trim(),
          mode: 'insensitive'
        }
      }
    });

    const messages = await prisma.message.findMany({
      where: {
        groupId,
        content: {
          contains: query.trim(),
          mode: 'insensitive'
        }
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatar: true,
            isOnline: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum
    });

    const totalPages = Math.ceil(totalMessages / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.json({
      success: true,
      messages: messages.reverse(), // Reverse to get chronological order
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalMessages,
        totalPages,
        hasNextPage,
        hasPrevPage
      }
    });

  } catch (error) {
    console.error('Error searching messages:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while searching messages'
    });
  }
}
}

module.exports = new ChatController();
