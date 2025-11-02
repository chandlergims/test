import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { opinionId } = await req.json();

    if (!opinionId) {
      return NextResponse.json(
        { error: 'Opinion ID is required' },
        { status: 400 }
      );
    }

    // Build headers
    const headers: any = {
      'Content-Type': 'application/json',
    };
    
    if (process.env.COURTLISTENER_API_KEY) {
      headers['Authorization'] = `Token ${process.env.COURTLISTENER_API_KEY}`;
    }

    // Fetch full opinion details
    const opinionUrl = `https://www.courtlistener.com/api/rest/v4/opinions/${opinionId}/`;
    const response = await fetch(opinionUrl, { headers });

    if (!response.ok) {
      return NextResponse.json(
        { error: `CourtListener API error: ${response.status}` },
        { status: response.status }
      );
    }

    const opinionData = await response.json();

    return NextResponse.json({
      fullText: opinionData.plain_text || opinionData.html_with_citations || opinionData.html || 'Full text not available',
      download_url: opinionData.download_url || '',
      type: opinionData.type || '',
      author_str: opinionData.author_str || '',
    });
  } catch (error: any) {
    console.error('Error fetching case details:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch case details' },
      { status: 500 }
    );
  }
}
