import connectDB from '@/lib/db/connect';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }
    await connectDB();

    // Ensure models are registered
    const { User } = await import('@/lib/models');

    const { name, email, password, role = 'student', grade, language = 'en' } = await request.json();

    // Validation
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    if (role === 'student' && !grade) {
      return NextResponse.json(
        { error: 'Grade is required for students' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role,
      grade: role === 'student' ? grade : undefined,
      language
    });

    await user.save();

    // Return user without password
    const userResponse = user.toJSON();

    return NextResponse.json(
      {
        message: 'User created successfully',
        user: userResponse
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Registration error:', error);

    // Handle mongoose validation errors
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