import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

export async function GET() {
  try {
    const q = query(
      collection(db, 'judgments'),
      orderBy('timestamp', 'desc')
    );

    const snapshot = await getDocs(q);
    
    // Convert to OpenAI fine-tuning format (JSONL)
    const trainingData = snapshot.docs
      .filter(doc => doc.data().response && doc.data().response.trim() !== '') // Only include completed judgments
      .map(doc => {
        const data = doc.data();
        return {
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that judges queries based on cases. Provide clear and concise responses."
            },
            {
              role: "user",
              content: data.query
            },
            {
              role: "assistant",
              content: data.response
            }
          ]
        };
      });

    // Convert to JSONL format (one JSON object per line)
    const jsonl = trainingData.map(item => JSON.stringify(item)).join('\n');

    // Return as downloadable file
    return new NextResponse(jsonl, {
      headers: {
        'Content-Type': 'application/jsonl',
        'Content-Disposition': 'attachment; filename="training-data.jsonl"',
      },
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export training data' },
      { status: 500 }
    );
  }
}
