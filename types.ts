
export interface StockData {
  date: Date;
  close: number;
}

export interface AnalysisResult {
  profitablePercentage: number;
  averageReturn: number;
  bestReturn: number;
  worstReturn: number;
  totalPeriods: number;
}
