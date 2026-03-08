import connectDB from '@/lib/db/connect';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }
    await connectDB();

    // Ensure models are registered
    const { Achievement } = await import('@/lib/models');

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const category = searchParams.get('category');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit')) || 50;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    let query = { userId, isVisible: true };

    if (category) {
      query.category = category;
    }

    if (type) {
      query.type = type;
    }

    const achievements = await Achievement.find(query)
      .sort({ earnedAt: -1 })
      .limit(limit);

    // Get achievement summary
    const summary = await Achievement.aggregate([
      { $match: { userId, isVisible: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalPoints: { $sum: '$points' },
          rarities: {
            $push: '$rarity'
          }
        }
      }
    ]);

    // Calculate total points
    const totalPoints = await Achievement.aggregate([
      { $match: { userId, isVisible: true } },
      {
        $group: {
          _id: null,
          total: { $sum: '$points' }
        }
      }
    ]);

    return NextResponse.json(
      {
        achievements,
        summary,
        totalPoints: totalPoints[0]?.total || 0
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Get achievements error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}