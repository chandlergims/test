import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Search CourtListener API v4 for relevant cases (opinions)
    const searchUrl = `https://www.courtlistener.com/api/rest/v4/search/?q=${encodeURIComponent(query)}&type=o&order_by=score%20desc`;
    
    // Build headers - API key is optional for read operations
    const headers: any = {
      'Content-Type': 'application/json',
    };
    
    // Add authentication if API key is provided
    if (process.env.COURTLISTENER_API_KEY) {
      headers['Authorization'] = `Token ${process.env.COURTLISTENER_API_KEY}`;
    }
    
    const response = await fetch(searchUrl, { headers });

    if (!response.ok) {
      return NextResponse.json(
        { error: `CourtListener API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    console.log('Search API Response:', JSON.stringify(data, null, 2));
    
    // Extract top 5 most relevant cases
    const cases = data.results?.slice(0, 5).map((item: any) => {
      // Try multiple fields for summary in order of preference
      let summary = 'No summary available';
      
      if (item.snippet && item.snippet.trim()) {
        summary = item.snippet;
      } else if (item.text && item.text.trim()) {
        summary = item.text.substring(0, 800);
      } else if (item.caseName || item.case_name) {
        summary = `Court case: ${item.caseName || item.case_name}. Full text may be available at CourtListener.`;
      }
      
      console.log('Processing case:', {
        name: item.caseName || item.case_name,
        hasSnippet: !!item.snippet,
        hasText: !!item.text,
        snippetLength: item.snippet?.length || 0
      });
      
      return {
        id: item.id || '', // Opinion ID for fetching full details
        name: item.caseName || item.case_name || 'Unknown Case',
        court: item.court || 'Unknown Court', 
        date: item.dateFiled || item.date_filed || '',
        summary: summary,
        url: item.absolute_url || item.url || '',
      };
    }) || [];

    return NextResponse.json({ cases, total: data.count || 0 });
  } catch (error: any) {
    console.error('CourtListener search error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search court cases' },
      { status: 500 }
    );
  }
}
