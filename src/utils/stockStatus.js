/**
 * The three stock states the backend reports for a product (StockStatus), with the one colour
 * each always gets - the same green / amber / red the dashboard's stock donut uses.
 * `tone` is the matching Badge tone.
 */
export const STOCK_STATUS = {
  IN_STOCK: { label: 'In stock', color: '#10b981', tone: 'success' },
  LOW_STOCK: { label: 'Low stock', color: '#f59e0b', tone: 'warning' },
  OUT_OF_STOCK: { label: 'Out of stock', color: '#ef4444', tone: 'danger' },
};
