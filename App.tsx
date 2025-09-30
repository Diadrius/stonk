
import React, { useState, useEffect, useCallback } from 'react';
import type { StockData, AnalysisResult } from './types';

// --- Helper Components (Defined outside the main App component to prevent re-creation on re-renders) ---

const StatCard: React.FC<{ label: string; value: string; colorClass: string }> = ({ label, value, colorClass }) => (
  <div className="bg-gray-800/50 p-6 rounded-lg text-center transform hover:scale-105 transition-transform duration-300">
    <p className="text-sm text-gray-400 uppercase tracking-wider mb-2">{label}</p>
    <p className={`text-3xl lg:text-4xl font-bold ${colorClass}`}>{value}</p>
  </div>
);

const LoadingSpinner: React.FC = () => (
    <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const App: React.FC = () => {
  const [stockData, setStockData] = useState<StockData[]>([]);
  const [holdingPeriod, setHoldingPeriod] = useState<string>('10');
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStockData = async () => {
      try {
        const response = await fetch('./stocks.csv');
        if (!response.ok) {
          throw new Error('Network response was not ok. Ensure stocks.csv is in the public directory.');
        }
        const csvText = await response.text();
        const rows = csvText.split('\n').slice(1); // Skip header
        const parsedData = rows
          .map(row => {
            const [dateStr, closeStr] = row.split(',');
            if (dateStr && closeStr) {
              const date = new Date(dateStr);
              const close = parseFloat(closeStr);
              if (!isNaN(date.getTime()) && !isNaN(close)) {
                return { date, close };
              }
            }
            return null;
          })
          .filter((item): item is StockData => item !== null)
          .sort((a, b) => a.date.getTime() - b.date.getTime()); // Ensure data is sorted by date
        
        setStockData(parsedData);
      } catch (e) {
        if (e instanceof Error) {
            setError(`Failed to load or parse stock data: ${e.message}`);
        } else {
            setError("An unknown error occurred while fetching data.");
        }
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchStockData();
  }, []);

  const handleCalculate = useCallback(() => {
    const periodYears = parseInt(holdingPeriod, 10);
    if (isNaN(periodYears) || periodYears < 1 || periodYears > 100) {
      setError('Please enter a valid holding period between 1 and 100 years.');
      return;
    }
    setError(null);
    setIsCalculating(true);
    setResults(null);

    // Use setTimeout to allow the UI to update to the loading state before the heavy calculation
    setTimeout(() => {
      const holdingPeriodDays = periodYears * 365;
      if (stockData.length < holdingPeriodDays) {
        setError('Not enough historical data for the selected holding period.');
        setIsCalculating(false);
        return;
      }

      const returns: number[] = [];
      for (let i = 0; i <= stockData.length - holdingPeriodDays; i++) {
        const currentPrice = stockData[i].close;
        const futurePrice = stockData[i + holdingPeriodDays -1].close;
        const returnOnInvestment = ((futurePrice - currentPrice) / currentPrice) * 100;
        returns.push(returnOnInvestment);
      }

      if (returns.length === 0) {
        setError('Could not calculate any holding periods. Please check the data and input.');
        setIsCalculating(false);
        return;
      }

      const totalPeriods = returns.length;
      const profitablePeriods = returns.filter(r => r > 0).length;
      const profitablePercentage = (profitablePeriods / totalPeriods) * 100;
      const averageReturn = returns.reduce((sum, r) => sum + r, 0) / totalPeriods;
      const bestReturn = Math.max(...returns);
      const worstReturn = Math.min(...returns);

      setResults({
        profitablePercentage,
        averageReturn,
        bestReturn,
        worstReturn,
        totalPeriods,
      });

      setIsCalculating(false);
    }, 50);

  }, [holdingPeriod, stockData]);

  const formatPercent = (value: number) => `${value.toFixed(2)}%`;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-cyan-400 mb-2">S&P 500 Return Analyzer</h1>
          <p className="text-gray-400 text-lg">Analyze historical returns over different holding periods.</p>
        </div>

        <div className="bg-gray-800 rounded-xl shadow-2xl p-6 sm:p-10">
          {isLoadingData ? (
             <div className="flex flex-col items-center justify-center h-48">
                <LoadingSpinner />
                <p className="mt-4 text-gray-300">Loading historical data...</p>
             </div>
          ) : error && stockData.length === 0 ? (
             <div className="text-center text-red-400 bg-red-900/20 p-4 rounded-lg">{error}</div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
                <label htmlFor="holding-period" className="text-lg text-gray-300">Holding Period:</label>
                <input
                  id="holding-period"
                  type="number"
                  min="1"
                  max="100"
                  value={holdingPeriod}
                  onChange={(e) => setHoldingPeriod(e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded-md p-3 text-lg w-32 text-center focus:ring-2 focus:ring-cyan-500 focus:outline-none transition"
                  disabled={isCalculating}
                />
                 <span className="text-lg text-gray-300">Years</span>
                <button
                  onClick={handleCalculate}
                  disabled={isCalculating}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-8 rounded-md text-lg transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[150px]"
                >
                  {isCalculating ? <LoadingSpinner/> : 'Calculate'}
                </button>
              </div>

             {error && <div className="text-center text-red-400 bg-red-900/20 p-4 rounded-lg mb-8">{error}</div>}

              {results && (
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                    <StatCard 
                        label="Profitable Periods" 
                        value={formatPercent(results.profitablePercentage)}
                        colorClass="text-cyan-400" 
                    />
                    <StatCard 
                        label="Average Return" 
                        value={formatPercent(results.averageReturn)}
                        colorClass={results.averageReturn > 0 ? 'text-green-400' : 'text-red-400'}
                    />
                    <StatCard 
                        label="Best Return" 
                        value={formatPercent(results.bestReturn)}
                        colorClass="text-green-400"
                    />
                     <StatCard 
                        label="Worst Return" 
                        value={formatPercent(results.worstReturn)}
                        colorClass="text-red-400"
                    />
                   <div className="sm:col-span-2 lg:col-span-1">
                     <StatCard 
                          label="Total Periods Analyzed" 
                          value={results.totalPeriods.toLocaleString()}
                          colorClass="text-gray-200"
                      />
                   </div>
                 </div>
              )}
               {!results && !isCalculating &&
                <div className="text-center text-gray-500 pt-8">
                  <p>Enter a holding period and click "Calculate" to see the analysis.</p>
                </div>
               }
            </>
          )}
        </div>
        <footer className="text-center mt-8 text-gray-600 text-sm">
          <p>Data analysis is for informational purposes only and does not constitute financial advice.</p>
        </footer>
      </div>
       <style>{`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in {
            animation: fade-in 0.5s ease-out forwards;
          }
          input[type="number"]::-webkit-inner-spin-button, 
          input[type="number"]::-webkit-outer-spin-button { 
            -webkit-appearance: none; 
            margin: 0; 
          }
          input[type="number"] {
            -moz-appearance: textfield;
          }
      `}</style>
    </div>
  );
};

export default App;
