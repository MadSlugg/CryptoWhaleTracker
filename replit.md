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
  - Major Whales Box: Top 10 largest orders (100+ BTC)
  - Analytics: Order Book Imbalance, Entry Signals, Order Flow, Price Clusters
  - Liquidation Tracker: Leveraged position liquidation zones
  - Price Level Heatmap: Visual concentration map (50+ BTC orders)
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
- **Whale Analytics System**: Comprehensive analysis tools with explanatory descriptions
  - **Order Flow Indicator**: Real-time buying vs selling pressure from whale orders with progress bars
    - Description: "Real-time buying vs selling pressure from whale orders. Shows market sentiment and directional bias."
    - Shows long/short percentages, volumes, and pressure level (balanced/moderate/strong)
    - Handles neutral state when long and short volumes are equal
  - **Price Clusters**: Multiple large orders concentrated at similar price levels
    - Description: "Multiple large orders concentrated at similar price levels. Indicates strong support or resistance zones."
    - Groups orders within $1000 price ranges
    - Shows top 10 clusters (3+ orders or 50+ BTC threshold)
    - Displays long/short breakdown with counts and BTC amounts
    - Badge indicates dominant type based on BTC volume (LONG/SHORT/Balanced)
    - Dominance threshold: >20% more volume than average
    - Scrollable container with 500px max height
- **Order Book Imbalance**: Real-time supply/demand pressure indicator
  - Description: "Real-time supply and demand pressure from active whale orders. Shows market depth imbalance."
  - Shows bid (buy) vs ask (sell) liquidity
  - Imbalance ratio from -100% (strong sell pressure) to +100% (strong buy pressure)
  - Pressure level badges: STRONG BUY/SELL, MODERATE BUY/SELL, SLIGHT BUY/SELL, BALANCED
  - Visual balance bar showing buy/sell pressure split
  - Detailed metrics: BTC volume, USD notional value, order counts for both sides
  - Total active liquidity display
  - Respects user's filter selections for time range, type, exchange, and status
- **Price Entry Signals**: Intelligent entry point identification based on whale positioning
  - Analyzes active whale orders to find support/resistance levels
  - Groups orders into $500 price buckets for precise analysis
  - **LONG signals**: Strong buy support below current price (potential entry for long positions)
  - **SHORT signals**: Strong sell resistance above current price (potential entry for short positions)
  - Strength levels: STRONG (>50 BTC), MODERATE (>20 BTC), WEAK (<20 BTC)
  - Identifies trapped traders (recently filled counter-positions) indicating potential squeezes/dumps
  - Only shows entries within ±15% of current price (realistic entry range)
  - Displays top 5 signals sorted by strength and whale volume
  - Shows detailed reasoning for each signal with whale volume and order counts
  - Uses side-specific counts (only long orders for long signals, only short orders for short signals)
- **Price Level Heatmap**: Visual map of whale concentration across price levels (50+ BTC orders only)
  - Description: "Visual map of whale concentration across price levels. Brighter colors indicate higher volume clusters."
  - **Internal 50+ BTC Filter**: Only shows orders >= 50 BTC, works in combination with user's selected filters
  - Groups orders into $2,000 price buckets
  - Color intensity based on total BTC volume (5 intensity levels: 0-20%, 20-40%, 40-60%, 60-80%, 80-100%)
  - Green for long-dominant levels, red for short-dominant levels
  - Highlights current Bitcoin price level
  - Shows long/short breakdown per level (order counts and BTC amounts)
  - Intensity bar at bottom of each level
  - Scrollable with max height for performance
  - Summary stats: total orders, total volume, number of price levels
- **Liquidation Tracker**: Shows where leveraged positions will be forcefully closed
  - Description: "Shows where leveraged positions will be forcefully closed. When price reaches these levels, liquidations trigger automatic buying or selling that can accelerate price movement."
  - Analyzes whale orders to estimate liquidation levels (assuming 10x leverage)
  - Shows up to 8 most relevant clusters within ±30% of current price
  - Color-coded impact explanations for each cluster
  - Cascade risk indicators (HIGH/MEDIUM/LOW)
  - Educational guidance on using liquidation data

**Routing**: Wouter for client-side routing

**Order Display**:
- Active Orders and Filled Orders sections at bottom of dashboard
- Each section limited to 5 most recent orders for compact display
- Shows "Showing X of Y" counter to indicate total available orders
- Scrollable containers with 500px max height
- Order cards display position type, exchange, status, BTC amount, price, and timestamp

### Backend Architecture

**Runtime**: Node.js with Express.js server

**Data Storage**: In-memory storage (MemStorage class) - no persistent database currently implemented, though Drizzle ORM is configured for potential PostgreSQL integration

**Real-time Communication**: WebSocket server (ws library) for broadcasting order updates to connected clients

**Liquidation Tracker**: Displays liquidation clusters where leveraged positions will be forcefully closed
- Simulates liquidation levels based on whale orders (estimates 10x leverage liquidation points)
- Long liquidation clusters: ~10% below whale long positions (triggers selling pressure when price drops)
- Short liquidation clusters: ~10% above whale short positions (triggers buying pressure when price rises)
- Shows up to 8 most relevant clusters within ±30% of current price
- Each cluster displays:
  - Price level and distance from current price
  - Liquidation type (LONG LIQ or SHORT LIQ)
  - Cascade risk (HIGH/MEDIUM/LOW) based on volume
  - Impact explanation: what happens if price reaches this level
  - BTC volume, position count, and USD notional value
- Color-coded by impact:
  - Red background: Long liquidations (selling pressure if price drops)
  - Green background: Short liquidations (buying pressure if price rises)
- Educational footer explaining how to use liquidation clusters:
  - Avoid getting liquidated
  - Anticipate cascade events
  - Trade bounces after large liquidations
  - Follow smart money hunting liquidations

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
- Filled order detection: Orders automatically transition from "active" to "filled" status when market price crosses order limit price
  - Long orders filled when market price ≤ limit price
  - Short orders filled when market price ≥ limit price
  - Sweep runs every 10 seconds to detect filled orders

**API Endpoints**:
- `GET /api/orders` - Retrieve filtered orders with query parameters for minSize, orderType, exchange, timeRange, and status
- `GET /api/whale-movements` - Retrieve whale movement data
- `GET /api/long-short-ratios` - Retrieve long/short ratio history
- `GET /api/long-short-ratio/latest` - Get latest long/short ratio
- `GET /api/liquidations` - Retrieve liquidation events
- `GET /api/whale-correlations` - Retrieve whale correlation analysis

**Data Cleanup**: Automated hourly cleanup removing orders older than 24 hours

### External Dependencies

**UI Component Libraries**:
- Radix UI primitives for accessible, unstyled components
- Tailwind CSS for utility-first styling
- Lucide React for icons
- date-fns for timestamp formatting

**Database (Configured but Not Active)**:
- Drizzle ORM configured with PostgreSQL dialect
- Neon Database serverless driver (@neondatabase/serverless)
- Schema defined but storage currently uses in-memory implementation

**Development Tools**:
- Vite for fast development and optimized production builds
- TypeScript for type safety
- Replit-specific plugins for development environment integration

**Form & Validation**:
- React Hook Form with Zod resolvers for form handling
- Zod for schema validation

**WebSocket**: Native WebSocket API on client, ws library on server

**Session Management**: connect-pg-simple configured (for PostgreSQL sessions, currently unused)