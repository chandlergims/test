'use client';

import Navbar from '@/components/Navbar';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, query as firebaseQuery, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { useAccount } from 'wagmi';
import { Copy, Check } from '@phosphor-icons/react';

interface TrainingData {
  id: string;
  query: string;
  response: string;
  timestamp: Date;
  walletAddress?: string;
}

export default function Home() {
  const [userQuery, setUserQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [trainingData, setTrainingData] = useState<TrainingData[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [courtCases, setCourtCases] = useState<any[]>([]);
  const [showCases, setShowCases] = useState(false);
  const [caseSearchQuery, setCaseSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [caseDetails, setCaseDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const { address, isConnected } = useAccount();

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleExport = () => {
    window.open('/api/export-training-data', '_blank');
  };

  const handleCaseSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!caseSearchQuery.trim()) {
      return;
    }
    
    setSearchLoading(true);
    setExpandedCaseId(null);
    
    try {
      const res = await fetch('/api/search-cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: caseSearchQuery }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to search cases');
      }

      setSearchResults(data.cases || []);
    } catch (error: any) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleViewDetails = async (opinionId: string) => {
    if (expandedCaseId === opinionId) {
      setExpandedCaseId(null);
      return;
    }
    
    setExpandedCaseId(opinionId);
    setDetailsLoading(true);
    
    try {
      const res = await fetch('/api/case-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ opinionId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch details');
      }

      setCaseDetails(data);
    } catch (error: any) {
      console.error('Details error:', error);
      setCaseDetails({ fullText: 'Error loading case details' });
    } finally {
      setDetailsLoading(false);
    }
  };

  // Fetch training data from Firebase
  useEffect(() => {
    const q = firebaseQuery(
      collection(db, 'judgments'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const data: TrainingData[] = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        query: doc.data().query,
        response: doc.data().response,
        timestamp: doc.data().timestamp?.toDate() || new Date(),
        walletAddress: doc.data().walletAddress,
      }));
      setTrainingData(data);
      
      // Count completed training examples (with responses)
      const completedCount = data.filter(item => item.response && item.response.trim() !== '').length;
      setTotalCount(completedCount);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userQuery.trim()) {
      return;
    }
    
    setLoading(true);
    setResponse('');
    
    const queryToSubmit = userQuery;
    
    // Save to Firebase immediately
    const docRef = await addDoc(collection(db, 'judgments'), {
      query: queryToSubmit,
      response: '', // Will be updated later
      timestamp: Timestamp.now(),
      walletAddress: address || 'anonymous',
    });

    // Clear the query input immediately
    setUserQuery('');
    
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: queryToSubmit }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      setResponse(data.response);
      setCourtCases(data.courtCases || []);

      // Update Firebase with the response
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'judgments', docRef.id), {
        response: data.response,
      });
    } catch (error: any) {
      console.error('Error:', error);
      setResponse(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#121212' }}>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - AI Judgment */}
          <div className="space-y-8">
            {/* AI Judgment System */}
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">AI Judgment System</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="query" className="block text-sm font-medium text-gray-300 mb-2">
                  Enter Case Query
                </label>
                <textarea
                  id="query"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-zinc-900 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent resize-none text-sm"
                  placeholder="Describe the case or query..."
                />
              </div>
              <button
                type="submit"
                disabled={loading || !userQuery.trim()}
                className="w-full px-6 py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {loading ? 'Analyzing...' : 'Get Judgment'}
              </button>
            </form>

            {response && (
              <div className="mt-6 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Judgment:</h3>
                  <div className="p-4 bg-zinc-900/50 border border-white/10 rounded-lg">
                    <p className="text-gray-200 text-sm leading-relaxed">{response}</p>
                  </div>
                </div>

                {courtCases.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowCases(!showCases)}
                      className="text-xs font-medium text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                    >
                      {showCases ? '▼' : '▶'} CourtListener Results ({courtCases.length} cases)
                    </button>
                    
                    {showCases && (
                      <div className="mt-3 space-y-3">
                        {courtCases.map((caseItem: any, index: number) => (
                          <div
                            key={index}
                            className="p-3 bg-zinc-900/30 border border-white/10 rounded-lg"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-white mb-1">
                                  {index + 1}. {caseItem.name}
                                </p>
                                {caseItem.court && (
                                  <p className="text-xs text-gray-400 mb-1">
                                    Court: {caseItem.court}
                                  </p>
                                )}
                                {caseItem.date && (
                                  <p className="text-xs text-gray-400 mb-2">
                                    Date: {caseItem.date}
                                  </p>
                                )}
                                {caseItem.summary && (
                                  <p className="text-xs text-gray-300 leading-relaxed">
                                    {caseItem.summary}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>

            {/* Court Case Search */}
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Search Court Cases</h2>
              <form onSubmit={handleCaseSearch} className="space-y-4">
                <div>
                  <label htmlFor="caseSearch" className="block text-sm font-medium text-gray-300 mb-2">
                    Search CourtListener Database
                  </label>
                  <textarea
                    id="caseSearch"
                    value={caseSearchQuery}
                    onChange={(e) => setCaseSearchQuery(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 bg-zinc-900 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent resize-none text-sm"
                    placeholder="Search for court cases..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={searchLoading || !caseSearchQuery.trim()}
                  className="w-full px-6 py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {searchLoading ? 'Searching...' : 'Search Cases'}
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">
                    Found {searchResults.length} Cases:
                  </h3>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-zinc-900 [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {searchResults.map((caseItem: any, index: number) => (
                      <div
                        key={index}
                        className="p-4 bg-zinc-900/50 border border-white/10 rounded-lg"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-medium text-white flex-1">
                            {index + 1}. {caseItem.name}
                          </p>
                          {caseItem.id && (
                            <button
                              onClick={() => handleViewDetails(caseItem.id)}
                              className="px-2 py-1 text-xs bg-zinc-800 text-white rounded hover:bg-zinc-700 transition-colors"
                            >
                              {expandedCaseId === caseItem.id ? 'Hide' : 'View'} Details
                            </button>
                          )}
                        </div>
                        {caseItem.court && (
                          <p className="text-xs text-gray-400 mb-1">
                            <span className="font-medium">Court:</span> {caseItem.court}
                          </p>
                        )}
                        {caseItem.date && (
                          <p className="text-xs text-gray-400 mb-2">
                            <span className="font-medium">Date:</span> {caseItem.date}
                          </p>
                        )}
                        {caseItem.summary && (
                          <p className="text-xs text-gray-300 leading-relaxed mt-2">
                            {caseItem.summary}
                          </p>
                        )}
                        
                        {expandedCaseId === caseItem.id && (
                          <div className="mt-4 pt-4 border-t border-white/10">
                            {detailsLoading ? (
                              <p className="text-xs text-gray-400">Loading full text...</p>
                            ) : caseDetails?.fullText ? (
                              <div className="max-h-[400px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-zinc-900 [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb]:rounded-full">
                                <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                                  {caseDetails.fullText}
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400">Full text not available</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Training Data */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Training Data</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {totalCount} examples {totalCount >= 50 ? '✅ Ready to train!' : `(${50 - totalCount} more needed)`}
                </p>
              </div>
              {totalCount >= 10 && (
                <button
                  onClick={handleExport}
                  className="px-3 py-1.5 bg-zinc-800 text-white text-xs font-medium rounded hover:bg-zinc-700 transition-colors border border-white/10"
                >
                  Export JSONL
                </button>
              )}
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-zinc-900 [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-zinc-600">
              {trainingData.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-xs">No training data yet</p>
                </div>
              ) : (
                trainingData.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-zinc-900/30 border border-white/10 rounded-lg hover:bg-zinc-900/50 transition-colors"
                  >
                    <div>
                      <p className="text-[10px] text-gray-500 mb-1">
                        {item.timestamp.toLocaleDateString()} {item.timestamp.toLocaleTimeString()}
                      </p>
                      {item.walletAddress && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <p className="text-[10px] text-gray-600 font-mono">
                            {item.walletAddress.slice(0, 6)}...{item.walletAddress.slice(-4)}
                          </p>
                          <button
                            onClick={() => copyToClipboard(item.walletAddress!, item.id)}
                            className="text-gray-500 hover:text-gray-300 transition-colors"
                            title="Copy wallet address"
                          >
                            {copiedId === item.id ? (
                              <Check size={12} weight="bold" className="text-green-500" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      )}
                      <p className="text-gray-300 text-xs leading-snug">{item.query}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
