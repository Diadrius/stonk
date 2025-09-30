
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

const Bar: React.FC<{ value: number; maxValue: number; colorClass: string; label: string; rawValue: number }> = ({ value, maxValue, colorClass, label, rawValue }) => {
    const heightPercentage = Math.min(100, (Math.abs(value) / maxValue) * 100);
    const isNegative = value < 0;
    return (
        <div className="flex flex-col items-center h-48 relative group">
            <div className={`w-12 flex flex-col justify-end`} style={{ height: '50%' }}>
                {!isNegative && (
                    <div className={`w-full ${colorClass} rounded-t-sm`} style={{ height: `${heightPercentage}%` }}></div>
                )}
            </div>
            <div className={`w-12 flex flex-col justify-start`} style={{ height: '50%' }}>
                {isNegative && (
                    <div className={`w-full ${colorClass} rounded-b-sm`} style={{ height: `${heightPercentage}%` }}></div>
                )}
            </div>
            <p className="text-sm mt-2">{label}</p>
            <div className="absolute bottom-full mb-2 w-max bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {rawValue.toFixed(2)}%
            </div>
        </div>
    );
};

const ReturnsChart: React.FC<{ results: AnalysisResult }> = ({ results }) => {
    const { bestReturn, worstReturn, averageReturn } = results;
    const maxVal = Math.max(Math.abs(bestReturn), Math.abs(worstReturn), Math.abs(averageReturn));

    return (
        <div className="sm:col-span-2 lg:col-span-3 bg-gray-800/50 p-6 rounded-lg">
            <h3 className="text-lg font-bold text-center mb-4">Returns Overview</h3>
            <div className="relative flex justify-around items-end pt-4 h-56">
                <div className="absolute left-0 right-0 top-1/2 h-px bg-gray-500 z-0"></div>
                <Bar value={worstReturn} rawValue={worstReturn} maxValue={maxVal} colorClass="bg-red-500" label="Worst" />
                <Bar value={averageReturn} rawValue={averageReturn} maxValue={maxVal} colorClass={averageReturn > 0 ? "bg-green-500" : "bg-red-500"} label="Average" />
                <Bar value={bestReturn} rawValue={bestReturn} maxValue={maxVal} colorClass="bg-green-500" label="Best" />
            </div>
        </div>
    );
};


const App: React.FC = () => {
  const [stockData, setStockData] = useState<StockData[]>([]);
  const [holdingPeriod, setHoldingPeriod] = useState<string>('10');
  // DCA State
  const [dcaBuy, setDcaBuy] = useState<boolean>(false);
  const [dcaSell, setDcaSell] = useState<boolean>(false);
  const [dcaBuyPeriod, setDcaBuyPeriod] = useState<string>('1');
  const [dcaSellPeriod, setDcaSellPeriod] = useState<string>('1');

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
    const dcaBuyYears = parseInt(dcaBuyPeriod, 10);
    const dcaSellYears = parseInt(dcaSellPeriod, 10);

    if (isNaN(periodYears) || periodYears < 1 || periodYears > 100) {
        setError('Please enter a valid holding period between 1 and 100 years.');
        return;
    }
    if ((dcaBuy && (isNaN(dcaBuyYears) || dcaBuyYears < 1)) || (dcaSell && (isNaN(dcaSellYears) || dcaSellYears < 1))) {
        setError('DCA periods must be at least 1 year.');
        return;
    }

    const holdingPeriodDays = periodYears * 365;
    const dcaBuyDays = dcaBuyYears * 365;
    const dcaSellDays = dcaSellYears * 365;

    if ((dcaBuy && dcaBuyYears > periodYears) || (dcaSell && dcaSellYears > periodYears)) {
        setError('DCA period cannot be longer than the holding period.');
        return;
    }

    setError(null);
    setIsCalculating(true);
    setResults(null);

    setTimeout(() => {
      // The total window needed for one calculation
      const requiredDays = holdingPeriodDays + (dcaSell ? dcaSellDays - 1 : 0);
      if (stockData.length < requiredDays) {
        setError('Not enough historical data for the selected periods.');
        setIsCalculating(false);
        return;
      }
      
      const returns: number[] = [];
      // Loop until the start of the last possible sell DCA window
      for (let i = 0; i <= stockData.length - requiredDays; i++) {
        // Calculate Buy Price
        let buyPrice: number;
        if (dcaBuy) {
          const buyWindow = stockData.slice(i, i + dcaBuyDays);
          buyPrice = buyWindow.reduce((sum, day) => sum + day.close, 0) / buyWindow.length;
        } else {
          buyPrice = stockData[i].close;
        }

        // Calculate Sell Price
        let sellPrice: number;
        const sellWindowStart = i + holdingPeriodDays - 1;
        if (dcaSell) {
          const sellWindow = stockData.slice(sellWindowStart, sellWindowStart + dcaSellDays);
          sellPrice = sellWindow.reduce((sum, day) => sum + day.close, 0) / sellWindow.length;
        } else {
          sellPrice = stockData[sellWindowStart].close;
        }
        
        if(buyPrice > 0){
            const returnOnInvestment = ((sellPrice - buyPrice) / buyPrice) * 100;
            returns.push(returnOnInvestment);
        }
      }

      if (returns.length === 0) {
        setError('Could not calculate any returns. Please check the data and input parameters.');
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

  }, [holdingPeriod, stockData, dcaBuy, dcaSell, dcaBuyPeriod, dcaSellPeriod]);

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
              <div className="flex flex-col items-center justify-center gap-6 mb-10">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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
                </div>

                 {/* DCA Options Group */}
                 <div className="bg-gray-700/50 p-4 rounded-lg flex flex-col gap-4 items-stretch">
                   <DcaConfig
                        id="buy"
                        label="Buy"
                        isDca={dcaBuy}
                        setIsDca={setDcaBuy}
                        period={dcaBuyPeriod}
                        setPeriod={setDcaBuyPeriod}
                        isDisabled={isCalculating}
                    />
                     <DcaConfig
                        id="sell"
                        label="Sell"
                        isDca={dcaSell}
                        setIsDca={setDcaSell}
                        period={dcaSellPeriod}
                        setPeriod={setDcaSellPeriod}
                        isDisabled={isCalculating}
                    />
                </div>

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
                      <ReturnsChart results={results} />
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
          input[type="checkbox"] {
            appearance: none;
            background-color: #4A5568; /* bg-gray-700 */
            border: 1px solid #718096; /* border-gray-500 */
            padding: 0.5rem;
            border-radius: 4px;
            display: inline-block;
            position: relative;
            cursor: pointer;
          }
          input[type="checkbox"]:checked {
            background-color: #0891B2; /* bg-cyan-600 */
            border-color: #06B6D4; /* border-cyan-500 */
          }
           input[type="checkbox"]:checked::after {
            content: '✔';
            position: absolute;
            color: white;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 0.8rem;
          }
      `}</style>
    </div>
  );
};

const DcaConfig: React.FC<{
    id: string;
    label: string;
    isDca: boolean;
    setIsDca: (value: boolean) => void;
    period: string;
    setPeriod: (value: string) => void;
    isDisabled: boolean;
}> = ({ id, label, isDca, setIsDca, period, setPeriod, isDisabled }) => (
    <div className="flex items-center gap-3">
        <input 
            type="checkbox" 
            id={`dca-${id}`} 
            checked={isDca} 
            onChange={(e) => setIsDca(e.target.checked)} 
            className="h-5 w-5 rounded bg-gray-600 border-gray-500 text-cyan-500 focus:ring-cyan-600"
        />
        <label htmlFor={`dca-${id}`} className="text-gray-300 w-36 flex-shrink-0">Dollar-Cost Avg {label}</label>
        <div className="relative group">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 cursor-pointer" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="absolute bottom-full mb-2 w-64 bg-gray-900 text-white text-sm rounded-lg p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Average the {label.toLowerCase()} price over a period. Assumes buying/selling the same amount each day for the specified duration.
            </div>
        </div>
        <input
            type="number"
            min="1"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            disabled={isDisabled || !isDca}
            className="bg-gray-600 border-gray-500 rounded-md p-2 w-20 text-center focus:ring-2 focus:ring-cyan-500 focus:outline-none transition disabled:opacity-50"
        />
        <span className="text-gray-400">Years</span>
    </div>
);

export default App;
