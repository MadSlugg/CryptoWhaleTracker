# Bitcoin Whale Tracker

## Overview

A real-time Bitcoin trading dashboard that monitors and displays large cryptocurrency orders from Binance. The application tracks real whale trading activity (large buy/sell orders from Binance order book) and displays long and short positions. Built as a data-dense, utility-focused dashboard inspired by professional trading platforms like Binance and TradingView.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool

**UI Component System**: Shadcn/ui components built on Radix UI primitives, configured in "new-york" style with Tailwind CSS for styling

**Design Philosophy**: 
- Utility-focused trading dashboard with emphasis on information density and real-time data clarity
- High-contrast position type indicators (long/short) for instant visual recognition
- Minimal animations to maintain focus on critical trading data
- Typography uses Inter for general text and JetBrains Mono for numerical data (prices, amounts, timestamps)

**State Management**:
- React Query (@tanstack/react-query) for server state management and caching
- WebSocket connection for real-time order updates
- Local React state for UI filters and controls

**Key Features**:
- Real-time whale order feed with WebSocket updates
- Multi-exchange whale order tracking from Binance, Kraken, Coinbase, and OKX ($450k+ positions)
- Filterable dashboard (by size, order type, exchange, time range, and status)
- Real Bitcoin prices updated every 5 seconds
- Exchange badges on each order showing source exchange
- **Dashboard Layout**: Optimized information hierarchy with filters at top
  - Header: BTC price, long/short counts, refresh controls
  - Filter Controls: Set filters before viewing analytics (minSize, orderType, exchange, timeRange, status)
  - Summary Stats: Volume-weighted long/short ratio and total BTC volumes
  - **Filled Order Flow**: Price direction prediction based on whale execution patterns with time-decay weighting
  - Major Whales Box: Top 10 largest orders (100+ BTC)
  - Large Price Level Heatmap: Visual concentration map (50+ BTC orders, volume-weighted)
  - Order Book Imbalance: Supply/demand pressure from active whale orders
  - Price Clusters: Liquidation heatmap showing long/short breakdown (no height limit)
  - Depth Chart: Real-time order book visualization
  - Active/Filled Orders: Real-time feeds (5 most recent each)
- **Major Whales Display Box**: Prominent section showing top 10 largest orders (100+ BTC minimum)
  - Independent data query - NOT affected by user's filter selections
  - Always shows authoritative view of 100+ BTC orders (both active and filled)
  - Displays both LONG and SHORT positions from all exchanges
  - Only respects time range selection (24h, 7d, 30d, all)
  - MEGA WHALE badge for 1000+ BTC orders
  - Shows order size, type, price, exchange, and status
  - Auto-updates every 10 seconds with real-time data
- **Major Whale Alerts**: Real-time toast notifications for large orders:
  - 1000+ BTC orders: "MEGA WHALE ALERT - ACTIVE" or "MEGA WHALE - FILLED" (red/destructive variant, 10s duration)
  - 100+ BTC orders: "Large Whale Alert - ACTIVE" or "Large Whale - FILLED" (default variant, 7s duration)
  - Alerts trigger both when orders are placed (ACTIVE status) and when they execute (FILLED status)
  - Shows order size, type (LONG/SHORT), price, exchange, and status (ACTIVE/FILLED)
- **Summary Statistics**: Volume-weighted long vs short analysis
  - Shows long/short percentages weighted by actual BTC volume (not order count)
  - Displays total BTC volume for each side
  - Philosophy: "Not every trade is equal" - bigger trades have proper weight
- **Whale Analytics System**: Comprehensive analysis tools with explanatory descriptions
  - **Filled Order Flow**: Price direction prediction based on whale execution patterns with time-decay weighting
    - Description: "Time-weighted analysis of whale executions. Recent fills matter more. More longs = accumulation (bullish), more shorts = distribution (bearish)."
    - Analyzes FILLED orders only (actual whale executions, not intent)
    - **Time-Decay Weighting**: Recent fills have exponentially higher impact (30min old = 61% weight, 1hr = 37%, 2hr = 14%, 4hr = 2%)
    - Volume-weighted long/short execution ratio
    - Signal strength indicators:
      - STRONG ACCUMULATION (>40% difference): Whales aggressively buying dips - Strong bullish
      - ACCUMULATION (>20% difference): Whales buying weakness - Bullish
      - NEUTRAL (<20% difference): Balanced execution - No directional bias
      - DISTRIBUTION (>20% difference): Whales selling strength - Bearish
      - STRONG DISTRIBUTION (>40% difference): Whales aggressively selling rallies - Strong bearish
    - Visual bar showing actual volume percentages (long vs short)
    - Detailed metrics: filled long/short volumes, order counts
    - Philosophy: "Not every trade is equal" - weighted by BTC volume
    - Respects user's filter settings (minSize, exchange, timeRange)
    - Auto-updates every 10 seconds
  - **Price Clusters**: Liquidation heatmap showing whale concentration at price levels
    - Description: "Multiple large orders concentrated at similar price levels. Indicates strong support or resistance zones."
    - Analyzes ACTIVE orders only (consistent with Order Book Imbalance)
    - Groups orders within $1000 price ranges
    - Shows important clusters only: 2+ orders OR 50+ BTC total (filters out trivial single-order levels)
    - Respects user's filter settings (minSize, orderType, exchange, status) then applies cluster significance filter
    - Horizontal bar visualization with color gradients (green for longs, red for shorts, blue for mixed)
    - Bar width indicates volume intensity relative to maximum cluster
    - Displays long/short breakdown as "L:X S:Y" format on each bar
    - Badge indicates dominant type based on BTC volume (LONG/SHORT/MIX)
    - Dominance threshold: >20% more volume than average
    - Hover tooltips show detailed breakdown with price range and intensity percentage
- **Order Book Imbalance**: Real-time supply/demand pressure indicator
  - Description: "Real-time supply and demand pressure from active whale orders. Shows market depth imbalance."
  - Shows bid (buy) vs ask (sell) liquidity
  - Imbalance ratio from -100% (strong sell pressure) to +100% (strong buy pressure)
  - Pressure level badges: STRONG BUY/SELL, MODERATE BUY/SELL, SLIGHT BUY/SELL, BALANCED
  - Visual balance bar showing buy/sell pressure split
  - Detailed metrics: BTC volume, USD notional value, order counts for both sides
  - Total active liquidity display
  - Respects user's filter selections for time range, type, exchange, and status
- **Large Price Level Heatmap**: Visual map of whale concentration across price levels (50+ BTC orders only)
  - Description: "Visual map of whale concentration across price levels. Brighter colors indicate higher volume clusters."
  - Analyzes ACTIVE orders only (consistent with Price Clusters and Order Book Imbalance)
  - **Internal 50+ BTC Filter**: Only shows active orders >= 50 BTC, works in combination with user's selected filters
  - Groups orders into $2,000 price buckets
  - Color intensity based on total BTC volume (5 intensity levels: 0-20%, 20-40%, 40-60%, 60-80%, 80-100%)
  - Green for long-dominant levels, red for short-dominant levels
  - Highlights current Bitcoin price level
  - Shows long/short breakdown per level (order counts and BTC amounts)
  - Intensity bar at bottom of each level
  - Scrollable with max height for performance
  - Summary stats: total orders, total volume, number of price levels

**Routing**: Wouter for client-side routing

**Order Display**:
- Active Orders and Filled Orders sections at bottom of dashboard
- Each section limited to 5 most recent orders for compact display
- Shows "Showing X of Y" counter to indicate total available orders
- Scrollable containers with 500px max height
- Order cards display position type, exchange, status, BTC amount, price, and timestamp
- Order statuses: Active (outlined), Filled (grey)

### Backend Architecture

**Runtime**: Node.js with Express.js server

**Data Storage**: PostgreSQL database with persistent storage using Drizzle ORM
- All whale tracking data (orders, whale movements, long/short ratios, correlations) persists across application restarts
- Neon serverless PostgreSQL database with WebSocket connection pooling
- Automated cleanup of orders older than 7 days
- Database tables: bitcoin_orders, whale_movements, long_short_ratios, whale_correlations

**Real-time Communication**: WebSocket server (ws library) for broadcasting order updates to connected clients

**Multi-Exchange Integration**: Real-time Bitcoin whale tracking from multiple exchanges:
- **Binance**: Real Bitcoin prices fetched from ticker API every 5 seconds, order book polling every ~10 seconds
- **Kraken**: Order book polling every ~12 seconds using public Depth API (XXBTZUSD pair)
- **Coinbase**: Order book polling every ~14 seconds using Exchange API (BTC-USD pair)
- **OKX**: Order book polling every ~16 seconds using public market books API (BTC-USDT pair)
- All exchanges use public endpoints requiring no authentication
- Staggered polling intervals to distribute API load
- Fallback to last known price with small drift if API temporarily unavailable

**Order Tracking**: Real-only data from exchange order books:
- Real whale orders extracted from public order book depth (orders with $450k+ notional value)
- Each order tagged with source exchange (binance, kraken, coinbase, okx)
- Only displays orders that can be verified from exchanges' public order books
- No simulated data - all displayed positions are real market orders
- Exchange filter allows users to view orders from specific exchanges or all combined
- **Order Status Transitions**:
  - **Active → Filled**: Orders automatically transition when market price crosses order limit price
    - Long orders filled when market price ≤ limit price
    - Short orders filled when market price ≥ limit price
    - Sweep runs every 10 seconds to detect filled orders
  - **Active → Deleted**: Orders deleted when they vanish from exchange order books
    - During each exchange polling cycle (every 10-16 seconds), active orders are verified against FULL unfiltered order book
    - CRITICAL: Verification uses complete order book data, NOT filtered whale orders
    - This prevents false deletions of orders that fall outside discovery filters (e.g., price >20% from current market or size <$450k)
    - Orders that no longer exist in the order book are immediately deleted
    - Could indicate cancellation by whale trader or fill that occurred between polling windows
    - WebSocket broadcasts deletion event to frontend for real-time cache invalidation
- **Order Retention**: Orders are kept for 7 days before automatic cleanup
- **Verification vs Discovery**:
  - Discovery (new orders): Filtered by $450k+ notional and price within ±20% of current market
  - Verification (existing orders): Checks against FULL order book regardless of filters
  - This separation ensures we only delete orders that truly vanished, not orders outside our tracking criteria

**API Endpoints**:
- `GET /api/orders` - Retrieve filtered orders with query parameters for minSize, orderType, exchange, timeRange, and status (active/filled/all)
- `GET /api/filled-order-analysis` - Analyze filled orders to predict price direction with volume-weighted long/short ratios, signal strength, and execution levels (NEW)
- `GET /api/whale-movements` - Retrieve whale movement data
- `GET /api/long-short-ratios` - Retrieve long/short ratio history
- `GET /api/long-short-ratio/latest` - Get latest long/short ratio
- `GET /api/liquidations` - Retrieve liquidation events
- `GET /api/whale-correlations` - Retrieve whale correlation analysis

**Data Cleanup**: Automated hourly cleanup removing orders older than 7 days

### External Dependencies

**UI Component Libraries**:
- Radix UI primitives for accessible, unstyled components
- Tailwind CSS for utility-first styling
- Lucide React for icons
- date-fns for timestamp formatting

**Database**:
- Drizzle ORM with PostgreSQL dialect
- Neon Database serverless driver (@neondatabase/serverless) with WebSocket support
- Active persistent storage for all whale tracking data

**Development Tools**:
- Vite for fast development and optimized production builds
- TypeScript for type safety
- Replit-specific plugins for development environment integration

**Form & Validation**:
- React Hook Form with Zod resolvers for form handling
- Zod for schema validation

**WebSocket**: Native WebSocket API on client, ws library on server

**Session Management**: connect-pg-simple configured (for PostgreSQL sessions, currently unused)