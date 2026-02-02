import { Request, Response } from 'express';
import { prisma } from '../index';

// List events for browse (exclude events user is hosting or joined; filter/search/sort)
export const listEvents = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const category = (req.query.category as string) || undefined;
    const type = (req.query.type as string) || undefined;
    const dateFilter = (req.query.date as string) || undefined;
    const priceFilter = (req.query.price as string) || undefined;
    const search = (req.query.search as string)?.trim() || undefined;
    const sort = (req.query.sort as string) || 'upcoming';

    const where: any = {};

    if (category && category !== 'all') where.category = category;
    if (type && type !== 'all') where.type = type;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
        { organizer: { username: { contains: search, mode: 'insensitive' } } }
      ];
    }

    if (dateFilter && dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      if (dateFilter === 'today') {
        where.date = today.toISOString().slice(0, 10);
      } else if (dateFilter === 'tomorrow') {
        where.date = tomorrow.toISOString().slice(0, 10);
      } else if (dateFilter === 'this-week') {
        where.date = { gte: today.toISOString().slice(0, 10), lte: weekEnd.toISOString().slice(0, 10) };
      } else if (dateFilter === 'this-month') {
        where.date = { gte: today.toISOString().slice(0, 10), lte: monthEnd.toISOString().slice(0, 10) };
      }
    }

    if (priceFilter && priceFilter !== 'all') {
      if (priceFilter === 'free') where.price = 0;
      else if (priceFilter === 'paid') where.price = { gt: 0 };
      else if (priceFilter === 'under-50') where.price = { lt: 50 };
      else if (priceFilter === 'under-100') where.price = { lt: 100 };
    }

    // Exclude events where user is organizer or has joined
    if (userId) {
      where.organizerId = { not: userId };
      where.participants = { none: { userId } };
    }

    const orderBy: any =
      sort === 'popular'
        ? [{ participants: { _count: 'desc' } }, { date: 'asc' }]
        : sort === 'price-low'
          ? [{ price: 'asc' }, { date: 'asc' }]
          : sort === 'price-high'
            ? [{ price: 'desc' }, { date: 'asc' }]
            : [{ date: 'asc' }];

    const events = await prisma.event.findMany({
      where,
      include: {
        organizer: { select: { id: true, username: true, avatar: true, emailVerified: true } },
        _count: { select: { participants: true, reactions: true } }
      },
      orderBy
    });

    const list = events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      category: e.category,
      type: e.type,
      location: e.location,
      address: e.address,
      date: e.date,
      time: e.time,
      duration: e.duration,
      maxParticipants: e.maxParticipants,
      currentParticipants: e._count.participants + 1, // +1 for organizer
      price: e.price,
      currency: e.currency,
      tags: e.tags,
      isPrivate: e.isPrivate,
      isFeatured: e.isFeatured,
      image: e.image,
      language: e.language,
      highlights: e.highlights,
      organizer: {
        id: e.organizer.id,
        name: e.organizer.username,
        avatar: e.organizer.avatar || '👤',
        isVerified: !!e.organizer.emailVerified
      },
      isJoined: false,
      isBookmarked: false,
      reactionCount: e._count.reactions,
      createdAt: e.createdAt,
      lastUpdated: e.updatedAt
    }));

    return res.json({ success: true, events: list });
  } catch (error) {
    console.error('Event listEvents error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load events' });
  }
};

// Get my events (hosting + joined)
export const getMyEvents = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

    const [hosted, joined] = await Promise.all([
      prisma.event.findMany({
        where: { organizerId: userId },
        include: {
          organizer: { select: { id: true, username: true, avatar: true, emailVerified: true } },
          _count: { select: { participants: true, reactions: true } }
        },
        orderBy: { date: 'asc' }
      }),
      prisma.event.findMany({
        where: { participants: { some: { userId } } },
        include: {
          organizer: { select: { id: true, username: true, avatar: true, emailVerified: true } },
          _count: { select: { participants: true, reactions: true } }
        },
        orderBy: { date: 'asc' }
      })
    ]);

    const mapEvent = (e: any, isHosted: boolean) => {
      const org = e.organizer;
      return {
        id: e.id,
        title: e.title,
        description: e.description,
        category: e.category,
        type: e.type,
        location: e.location,
        address: e.address,
        date: e.date,
        time: e.time,
        duration: e.duration,
        maxParticipants: e.maxParticipants,
        currentParticipants: (e._count?.participants ?? 0) + 1, // +1 for organizer
        price: e.price,
        currency: e.currency,
        tags: e.tags,
        isPrivate: e.isPrivate,
        isFeatured: e.isFeatured,
        image: e.image,
        language: e.language,
        highlights: e.highlights,
        organizer: org
          ? { id: org.id, name: org.username, avatar: org.avatar || '👤', isVerified: !!org.emailVerified }
          : { id: userId, name: 'You', avatar: '👤', isVerified: false },
        isJoined: !isHosted,
        isBookmarked: false,
        status: 'upcoming',
        createdAt: e.createdAt,
        lastUpdated: e.updatedAt
      };
    };

    const hostedList = hosted.map((e) => mapEvent(e, true));
    const joinedList = joined.map((e) => mapEvent(e, false));

    return res.json({ success: true, hosted: hostedList, joined: joinedList });
  } catch (error) {
    console.error('Event getMyEvents error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load my events' });
  }
};

// Get single event by id (with organizer, participant count, reaction count, userJoined, userReacted)
export const getEvent = async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const userId = (req as any).userId;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organizer: { select: { id: true, username: true, avatar: true, emailVerified: true, bio: true } },
        _count: { select: { participants: true, reactions: true } },
        participants: userId ? { where: { userId } } : false,
        reactions: userId ? { where: { userId } } : false
      }
    });

    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const isOrganizer = event.organizerId === userId;
    const isJoined = !!(userId && (event as any).participants?.length);
    const userReacted = !!(userId && (event as any).reactions?.length);

    const socialMedia = (event.socialMedia as Record<string, string>) || {};

    const full: any = {
      id: event.id,
      title: event.title,
      description: event.description,
      longDescription: event.longDescription || event.aboutEvent,
      category: event.category,
      type: event.type,
      location: event.location,
      address: event.address,
      coordinates: event.coordinates,
      date: event.date,
      time: event.time,
      duration: event.duration,
      maxParticipants: event.maxParticipants,
      currentParticipants: ((event as any)._count?.participants ?? 0) + 1, // +1 for organizer
      price: event.price,
      currency: event.currency,
      organizer: {
        id: event.organizer.id,
        name: event.organizer.username,
        avatar: event.organizer.avatar || '👤',
        isVerified: !!event.organizer.emailVerified,
        bio: event.organizer.bio,
        contactEmail: event.contactEmail,
        contactPhone: event.contactPhone,
        website: event.website,
        socialMedia
      },
      tags: event.tags,
      isPrivate: event.isPrivate,
      isFeatured: event.isFeatured,
      image: event.image,
      language: event.language,
      skillLevel: event.skillLevel,
      ageRestriction: event.ageRestriction,
      dressCode: event.dressCode,
      requirements: event.requirements,
      highlights: event.highlights,
      aboutEvent: event.aboutEvent,
      virtualMeetingLink: event.virtualMeetingLink,
      additionalInfo: event.additionalInfo,
      agenda: event.agenda,
      rules: event.rules,
      cancellationPolicy: event.cancellationPolicy,
      refundPolicy: event.refundPolicy,
      transportation: event.transportation,
      parking: event.parking,
      accessibility: event.accessibility,
      photos: event.photos,
      documents: event.documents,
      isBookmarked: false,
      isJoined,
      isOrganizer,
      reactionCount: (event as any)._count?.reactions ?? 0,
      userReacted,
      createdAt: event.createdAt,
      lastUpdated: event.updatedAt
    };

    return res.json({ success: true, event: full });
  } catch (error) {
    console.error('Event getEvent error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load event' });
  }
};

// Create event (auth)
export const createEvent = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

    const body = req.body;
    if (!body.title?.trim() || !body.description?.trim() || !body.category?.trim()) {
      return res.status(400).json({ success: false, message: 'Title, description, and category are required' });
    }

    const organizer = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, avatar: true, emailVerified: true }
    });
    if (!organizer) return res.status(401).json({ success: false, message: 'User not found' });

    const event = await prisma.event.create({
      data: {
        organizerId: userId,
        title: body.title.trim(),
        description: body.description.trim(),
        longDescription: body.longDescription?.trim() || body.aboutEvent?.trim() || null,
        category: body.category.trim(),
        type: body.type || 'in-person',
        location: body.location?.trim() || '',
        address: body.address?.trim() || null,
        coordinates: body.coordinates || null,
        date: body.date || '',
        time: body.time || '',
        duration: typeof body.duration === 'number' ? body.duration : 60,
        maxParticipants: typeof body.maxParticipants === 'number' ? body.maxParticipants : 20,
        price: typeof body.price === 'number' ? body.price : 0,
        currency: body.currency || 'USD',
        tags: Array.isArray(body.tags) ? body.tags : [],
        isPrivate: !!body.isPrivate,
        isFeatured: !!body.isFeatured,
        image: body.image?.trim() || null,
        language: body.language?.trim() || null,
        skillLevel: body.skillLevel || null,
        ageRestriction: body.ageRestriction || null,
        dressCode: body.dressCode?.trim() || null,
        requirements: Array.isArray(body.requirements) ? body.requirements : [],
        highlights: Array.isArray(body.highlights) ? body.highlights : [],
        aboutEvent: body.aboutEvent?.trim() || null,
        virtualMeetingLink: body.virtualMeetingLink?.trim() || null,
        additionalInfo: body.additionalInfo?.trim() || null,
        agenda: Array.isArray(body.agenda) ? body.agenda : [],
        rules: Array.isArray(body.rules) ? body.rules : [],
        cancellationPolicy: body.cancellationPolicy?.trim() || null,
        refundPolicy: body.refundPolicy?.trim() || null,
        transportation: Array.isArray(body.transportation) ? body.transportation : [],
        parking: body.parking || null,
        accessibility: Array.isArray(body.accessibility) ? body.accessibility : [],
        photos: Array.isArray(body.photos) ? body.photos : [],
        documents: body.documents || null,
        contactEmail: body.contactEmail?.trim() || null,
        contactPhone: body.contactPhone?.trim() || null,
        website: body.website?.trim() || null,
        socialMedia: body.socialMedia && typeof body.socialMedia === 'object' ? body.socialMedia : null
      },
      include: { _count: { select: { participants: true, reactions: true } } }
    });

    const out = {
      id: event.id,
      title: event.title,
      description: event.description,
      category: event.category,
      type: event.type,
      location: event.location,
      date: event.date,
      time: event.time,
      duration: event.duration,
      maxParticipants: event.maxParticipants,
      currentParticipants: 1, // organizer
      price: event.price,
      currency: event.currency,
      organizer: {
        id: organizer.id,
        name: organizer.username,
        avatar: organizer.avatar || '👤',
        isVerified: !!organizer.emailVerified
      },
      tags: event.tags,
      isPrivate: event.isPrivate,
      isFeatured: event.isFeatured,
      image: event.image,
      highlights: event.highlights,
      isJoined: false,
      createdAt: event.createdAt,
      lastUpdated: event.updatedAt
    };

    return res.status(201).json({ success: true, event: out });
  } catch (error) {
    console.error('Event createEvent error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create event' });
  }
};

// Update event (auth, organizer only)
export const updateEvent = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

    const eventId = req.params.id;
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    if (event.organizerId !== userId) return res.status(403).json({ success: false, message: 'Only organizer can update' });

    const body = req.body;

    await prisma.event.update({
      where: { id: eventId },
      data: {
        title: body.title !== undefined ? body.title.trim() : undefined,
        description: body.description !== undefined ? body.description.trim() : undefined,
        longDescription: body.longDescription !== undefined ? (body.longDescription?.trim() || null) : undefined,
        category: body.category !== undefined ? body.category.trim() : undefined,
        type: body.type !== undefined ? body.type : undefined,
        location: body.location !== undefined ? body.location.trim() : undefined,
        address: body.address !== undefined ? (body.address?.trim() || null) : undefined,
        coordinates: body.coordinates !== undefined ? body.coordinates : undefined,
        date: body.date !== undefined ? body.date : undefined,
        time: body.time !== undefined ? body.time : undefined,
        duration: body.duration !== undefined ? body.duration : undefined,
        maxParticipants: body.maxParticipants !== undefined ? body.maxParticipants : undefined,
        price: body.price !== undefined ? body.price : undefined,
        currency: body.currency !== undefined ? body.currency : undefined,
        tags: body.tags !== undefined ? body.tags : undefined,
        isPrivate: body.isPrivate !== undefined ? body.isPrivate : undefined,
        isFeatured: body.isFeatured !== undefined ? body.isFeatured : undefined,
        image: body.image !== undefined ? (body.image?.trim() || null) : undefined,
        language: body.language !== undefined ? (body.language?.trim() || null) : undefined,
        skillLevel: body.skillLevel !== undefined ? body.skillLevel : undefined,
        ageRestriction: body.ageRestriction !== undefined ? body.ageRestriction : undefined,
        dressCode: body.dressCode !== undefined ? (body.dressCode?.trim() || null) : undefined,
        requirements: body.requirements !== undefined ? body.requirements : undefined,
        highlights: body.highlights !== undefined ? body.highlights : undefined,
        aboutEvent: body.aboutEvent !== undefined ? (body.aboutEvent?.trim() || null) : undefined,
        virtualMeetingLink: body.virtualMeetingLink !== undefined ? (body.virtualMeetingLink?.trim() || null) : undefined,
        additionalInfo: body.additionalInfo !== undefined ? (body.additionalInfo?.trim() || null) : undefined,
        agenda: body.agenda !== undefined ? body.agenda : undefined,
        rules: body.rules !== undefined ? body.rules : undefined,
        cancellationPolicy: body.cancellationPolicy !== undefined ? (body.cancellationPolicy?.trim() || null) : undefined,
        refundPolicy: body.refundPolicy !== undefined ? (body.refundPolicy?.trim() || null) : undefined,
        transportation: body.transportation !== undefined ? body.transportation : undefined,
        parking: body.parking !== undefined ? body.parking : undefined,
        accessibility: body.accessibility !== undefined ? body.accessibility : undefined,
        photos: body.photos !== undefined ? body.photos : undefined,
        documents: body.documents !== undefined ? body.documents : undefined,
        contactEmail: body.contactEmail !== undefined ? (body.contactEmail?.trim() || null) : undefined,
        contactPhone: body.contactPhone !== undefined ? (body.contactPhone?.trim() || null) : undefined,
        website: body.website !== undefined ? (body.website?.trim() || null) : undefined,
        socialMedia: body.socialMedia !== undefined ? body.socialMedia : undefined
      }
    });

    return res.json({ success: true, message: 'Event updated' });
  } catch (error) {
    console.error('Event updateEvent error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update event' });
  }
};

// Delete event (auth, organizer only)
export const deleteEvent = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

    const eventId = req.params.id;
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    if (event.organizerId !== userId) return res.status(403).json({ success: false, message: 'Only organizer can delete' });

    await prisma.event.delete({ where: { id: eventId } });
    return res.json({ success: true, message: 'Event deleted' });
  } catch (error) {
    console.error('Event deleteEvent error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete event' });
  }
};

// Join event (auth)
export const joinEvent = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

    const eventId = req.params.id;
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { _count: { select: { participants: true } } }
    });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    if (event.organizerId === userId) return res.status(400).json({ success: false, message: 'Organizer is already in the event' });
    if ((event as any)._count.participants >= event.maxParticipants) return res.status(400).json({ success: false, message: 'Event is full' });

    await prisma.eventParticipant.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId, status: 'confirmed' },
      update: { status: 'confirmed' }
    });

    return res.json({ success: true, message: 'Joined event' });
  } catch (error) {
    console.error('Event joinEvent error:', error);
    return res.status(500).json({ success: false, message: 'Failed to join event' });
  }
};

// Leave event (auth)
export const leaveEvent = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

    const eventId = req.params.id;
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    if (event.organizerId === userId) return res.status(400).json({ success: false, message: 'Organizer cannot leave' });

    await prisma.eventParticipant.deleteMany({
      where: { eventId, userId }
    });

    return res.json({ success: true, message: 'Left event' });
  } catch (error) {
    console.error('Event leaveEvent error:', error);
    return res.status(500).json({ success: false, message: 'Failed to leave event' });
  }
};

// Toggle heart reaction (auth)
export const reactEvent = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

    const eventId = req.params.id;
    const existing = await prisma.eventReaction.findUnique({
      where: { eventId_userId: { eventId, userId } }
    });

    if (existing) {
      await prisma.eventReaction.delete({
        where: { eventId_userId: { eventId, userId } }
      });
      const count = await prisma.eventReaction.count({ where: { eventId } });
      return res.json({ success: true, reacted: false, count });
    } else {
      await prisma.eventReaction.create({
        data: { eventId, userId, type: 'heart' }
      });
      const count = await prisma.eventReaction.count({ where: { eventId } });
      return res.json({ success: true, reacted: true, count });
    }
  } catch (error) {
    console.error('Event reactEvent error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update reaction' });
  }
};

// Get participants (organizer gets full list to remove; others get list for display)
export const getParticipants = async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organizer: { select: { id: true, username: true, avatar: true } },
        participants: { include: { user: { select: { id: true, username: true, avatar: true } } } }
      }
    });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const participants = [
      { id: event.organizer.id, name: event.organizer.username, avatar: event.organizer.avatar || '👤', isVerified: false, joinedAt: event.createdAt, status: 'confirmed', isOrganizer: true },
      ...(event as any).participants.map((p: any) => ({
        id: p.user.id,
        name: p.user.username,
        avatar: p.user.avatar || '👤',
        isVerified: false,
        joinedAt: p.joinedAt,
        status: p.status,
        isOrganizer: false
      }))
    ];

    return res.json({ success: true, participants });
  } catch (error) {
    console.error('Event getParticipants error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load participants' });
  }
};

// Remove participant (auth, organizer only)
export const removeParticipant = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

    const eventId = req.params.id;
    const targetUserId = req.params.userId;
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    if (event.organizerId !== userId) return res.status(403).json({ success: false, message: 'Only organizer can remove participants' });
    if (targetUserId === userId) return res.status(400).json({ success: false, message: 'Cannot remove yourself' });

    await prisma.eventParticipant.deleteMany({
      where: { eventId, userId: targetUserId }
    });

    return res.json({ success: true, message: 'Participant removed' });
  } catch (error) {
    console.error('Event removeParticipant error:', error);
    return res.status(500).json({ success: false, message: 'Failed to remove participant' });
  }
};

// Get event messages (auth, only if joined)
export const getMessages = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

    const eventId = req.params.id;
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { participants: true }
    });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const isOrganizer = event.organizerId === userId;
    const isJoined = isOrganizer || (event as any).participants.some((p: any) => p.userId === userId);
    if (!isJoined) return res.status(403).json({ success: false, message: 'Join the event to see chat' });

    const messages = await prisma.eventMessage.findMany({
      where: { eventId },
      include: { user: { select: { id: true, username: true, avatar: true } } },
      orderBy: { createdAt: 'asc' }
    });

    const list = messages.map((m: any) => ({
      id: m.id,
      user: { id: m.user.id, name: m.user.username, avatar: m.user.avatar || '👤' },
      content: m.content,
      timestamp: m.createdAt,
      type: m.type
    }));

    return res.json({ success: true, messages: list });
  } catch (error) {
    console.error('Event getMessages error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load messages' });
  }
};

// Send message (auth, only if joined)
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

    const eventId = req.params.id;
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ success: false, message: 'Content is required' });

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { participants: true }
    });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const isOrganizer = event.organizerId === userId;
    const isJoined = isOrganizer || (event as any).participants.some((p: any) => p.userId === userId);
    if (!isJoined) return res.status(403).json({ success: false, message: 'Join the event to chat' });

    const msg = await prisma.eventMessage.create({
      data: { eventId, userId, content: content.trim() },
      include: { user: { select: { id: true, username: true, avatar: true } } }
    });

    return res.status(201).json({
      success: true,
      message: {
        id: msg.id,
        user: { id: (msg as any).user.id, name: (msg as any).user.username, avatar: (msg as any).user.avatar || '👤' },
        content: msg.content,
        timestamp: msg.createdAt,
        type: msg.type
      }
    });
  } catch (error) {
    console.error('Event sendMessage error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};
