import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function searchCourtCases(query: string) {
  try {
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
      console.log('CourtListener API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    
    // Extract top 3 most relevant cases from search results
    const cases = data.results?.slice(0, 3).map((item: any) => ({
      name: item.caseName || item.case_name || 'Unknown Case',
      court: item.court || 'Unknown Court',
      date: item.dateFiled || item.date_filed || '',
      summary: item.snippet || (item.text ? item.text.substring(0, 500) : 'No summary available'),
      url: item.absolute_url || item.url || '',
    })) || [];

    console.log(`Found ${cases.length} relevant court cases for query: "${query}"`);
    return cases;
  } catch (error) {
    console.error('Error fetching court cases:', error);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Search for relevant court cases
    const courtCases = await searchCourtCases(query);

    // Build system message with court cases if available
    let systemMessage = 'You are a helpful assistant that judges queries based on cases. Provide clear and concise responses.';
    
    if (courtCases && courtCases.length > 0) {
      systemMessage += '\n\nRelevant Court Cases for Reference:\n';
      courtCases.forEach((caseItem: any, index: number) => {
        systemMessage += `\n${index + 1}. ${caseItem.name}`;
        if (caseItem.court) systemMessage += ` (${caseItem.court})`;
        if (caseItem.date) systemMessage += ` - ${caseItem.date}`;
        if (caseItem.summary) systemMessage += `\n   Summary: ${caseItem.summary}\n`;
      });
      systemMessage += '\nConsider these precedents when providing your judgment.';
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: systemMessage
        },
        {
          role: 'user',
          content: query
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content || 'No response generated';

    return NextResponse.json({ 
      response,
      courtCases: courtCases || [] 
    });
  } catch (error: any) {
    console.error('OpenAI API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process query' },
      { status: 500 }
    );
  }
}
