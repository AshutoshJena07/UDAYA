import connectDB from '@/lib/db/connect';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }
    await connectDB();

    // Ensure models are registered
    const { GameProgress, Achievement } = await import('@/lib/models');

    const {
      userId,
      gameId,
      category,
      score,
      maxScore, questionsAttempted,
      totalQuestions,
      timeSpent,
      streak = 0,
      hintsUsed = 0,
      difficulty = 'medium'
    } = await request.json();

    // Validation
    if (!userId || !gameId || !category || score === undefined || !maxScore || !questionsAttempted || !totalQuestions || !timeSpent) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create or update game progress
    const gameProgress = new GameProgress({
      userId,
      gameId,
      category,
      score,
      maxScore,
      questionsAttempted,
      totalQuestions,
      timeSpent,
      streak,
      hintsUsed,
      difficulty,
      completed: questionsAttempted >= totalQuestions
    });

    await gameProgress.save();

    // Check and award achievements
    const newAchievements = await Achievement.checkAndAward(userId, gameProgress);

    return NextResponse.json(
      {
        message: 'Game progress saved successfully',
        gameProgress,
        newAchievements
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Game progress error:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }
    await connectDB();

    // Ensure models are registered
    const { GameProgress } = await import('@/lib/models');

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const gameId = searchParams.get('gameId');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit')) || 10;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    let query = { userId };

    if (gameId) {
      query.gameId = gameId;
    }

    if (category) {
      query.category = category;
    }

    const gameProgress = await GameProgress.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    // Get user statistics
    const stats = await GameProgress.getUserStats(userId);

    return NextResponse.json(
      {
        gameProgress,
        stats
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Get game progress error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}