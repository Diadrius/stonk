
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
  coneData?: ConeDataPoint[];
}

export interface ConeDataPoint {
  timePoint: number; // 0 to 1 (normalized time through holding period)
  p10: number;       // 10th percentile return
  p25: number;       // 25th percentile return
  p50: number;       // 50th percentile (median) return
  p75: number;       // 75th percentile return
  p90: number;       // 90th percentile return
}
