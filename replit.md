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
- Filterable dashboard (by size, order type, exchange, time range, status, and price range)
- Summary statistics (24h volume, active longs/shorts)
- Real Bitcoin prices updated every 5 seconds
- Exchange badges on each order showing source exchange
- **Major Whales Display Box**: Prominent section showing top 10 largest orders (100+ BTC minimum)
  - Independent data query - NOT affected by user's filter selections
  - Always shows authoritative view of 100+ BTC orders (both active and filled)
  - Displays both LONG and SHORT positions from all exchanges
  - Only respects time range selection (24h, 7d, 30d, all)
  - MEGA WHALE badge for 1000+ BTC orders
  - Shows order size, type, price, exchange, and status
  - Auto-updates every 10 seconds with real-time data
- **Major Whale Alerts**: Real-time toast notifications for large orders:
  - 1000+ BTC orders: "MEGA WHALE ALERT" (red/destructive variant, 10s duration)
  - 100+ BTC orders: "Large Whale Alert" (default variant, 7s duration)
  - Alerts trigger both when orders are placed (NEW ORDER) and when they execute (FILLED)
  - Shows order size, type (LONG/SHORT), price, and exchange
- **Whale Analytics System**: Comprehensive analysis tools with explanatory descriptions
  - **Price Range Filter**: Search orders by specific Bitcoin price ranges (min/max price inputs)
  - **Order Flow Indicator**: Real-time buying vs selling pressure from whale orders with progress bars
    - Description: "Real-time buying vs selling pressure from whale orders. Shows market sentiment and directional bias."
    - Shows long/short percentages, volumes, and pressure level (balanced/moderate/strong)
    - Handles neutral state when long and short volumes are equal
  - **Price Clusters**: Multiple large orders concentrated at similar price levels
    - Description: "Multiple large orders concentrated at similar price levels. Indicates strong support or resistance zones."
    - Groups orders within $1000 price ranges
    - Shows top 5 clusters (3+ orders or 50+ BTC threshold)
    - Displays long/short breakdown with counts and BTC amounts
    - Badge indicates dominant type based on BTC volume (LONG/SHORT/Balanced)
    - Dominance threshold: >20% more volume than average
- **Price Level Heatmap**: Visual map of whale concentration across price levels (50+ BTC orders only)
  - Description: "Visual map of whale concentration across price levels. Brighter colors indicate higher volume clusters."
  - Groups orders into $2,000 price buckets
  - Color intensity based on total BTC volume (5 intensity levels: 0-20%, 20-40%, 40-60%, 60-80%, 80-100%)
  - Green for long-dominant levels, red for short-dominant levels
  - Highlights current Bitcoin price level
  - Shows long/short breakdown per level (order counts and BTC amounts)
  - Intensity bar at bottom of each level
  - Scrollable with max height for performance
  - Summary stats: total orders, total volume, number of price levels

**Routing**: Wouter for client-side routing

### Backend Architecture

**Runtime**: Node.js with Express.js server

**Data Storage**: In-memory storage (MemStorage class) - no persistent database currently implemented, though Drizzle ORM is configured for potential PostgreSQL integration

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
- Filled order detection: Orders automatically transition from "active" to "filled" status when market price crosses order limit price
  - Long orders filled when market price ≤ limit price
  - Short orders filled when market price ≥ limit price
  - Sweep runs every 10 seconds to detect filled orders

**API Endpoints**:
- `GET /api/orders` - Retrieve filtered orders with query parameters for minSize, orderType, exchange, timeRange, status, minPrice, and maxPrice
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