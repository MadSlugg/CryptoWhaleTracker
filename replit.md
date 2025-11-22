# Bitcoin Whale Tracker

## Overview
A real-time Bitcoin trading dashboard designed to monitor and display large cryptocurrency orders ("whale activity") from multiple exchanges. It tracks real-time long and short positions, providing a data-dense, utility-focused interface for professional traders. The project aims to offer critical insights into market movements driven by large players, enhancing strategic trading decisions.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, using Vite.
- **UI/UX**: Shadcn/ui components (Radix UI based) with Tailwind CSS, "new-york" style. Focus on information density, real-time data clarity, high-contrast indicators, minimal animations. Uses Inter for text and JetBrains Mono for numerical data.
- **State Management**: React Query for server state, WebSockets for real-time updates, local React state for UI filters.
- **Key Features**:
    - Real-time whale order feed from 10 exchanges: Binance, Bybit, Kraken, Bitfinex, Coinbase, OKX, Gemini, Bitstamp, KuCoin, and HTX (orders >= $450k).
    - **Market Type Tracking**: Each order labeled as SPOT or FUTURES. 7 exchanges track both spot and futures (Binance, Bybit, OKX, KuCoin, HTX, Kraken, Bitfinex), 3 track spot only (Coinbase, Gemini, Bitstamp).
    - Filterable dashboard by size, order type, exchange, time range, and status.
    - Real Bitcoin prices (updated every 5 seconds).
    - **Dashboard Layout**: Header (BTC price, date, refresh controls), Filter Controls, Major Whales (split into Active and Filled sections - top 10 orders >100 BTC with SPOT/FUTURES badges and timestamps, independent of filters except time range), Long/Short Entry Points (side-by-side directional recommendations), Filled Order Flow (price direction prediction), Price Clusters (support/resistance heatmap), Depth Chart, Active/Filled Orders (5 most recent each).
    - **Major Whales Component**:
        - **Active Major Whales**: Always visible section showing top 10 price levels with 100+ BTC orders currently on the books. Displays placement timestamps for each order.
        - **Filled Major Whales**: Collapsible section showing top 10 price levels with recently filled 100+ BTC orders. Displays both placement and execution timestamps with relative time (e.g., "Filled 2 minutes ago").
        - **MEGA ENTRY Orders**: 1000+ BTC orders displayed with orange border, larger text, and orange color for high visibility.
        - Orders grouped by price level and sorted by total BTC size. Expandable to show individual order details.
    - **Major Whale Alerts**: Real-time toast notifications for 100+ BTC and 1000+ BTC orders (MEGA ENTRY).
    - **Whale Analytics**:
        - **Filled Order Flow**: Time-decay weighted analysis of whale executions in the last 30 minutes, showing accumulation/distribution signals from both spot and futures markets.
        - **Price Clusters**: Identifies strong support/resistance zones from active orders concentrated at price levels (2+ orders or 50+ BTC total). Both spot and futures orders create valid support/resistance levels.
        - **Long Entry Points**: Shows STRONG_BUY and BUY signals based exclusively on big whale orders (50+ BTC). Displays "NO SIGNAL" state when no strong buy signals detected. Entry prices align with whale support levels.
        - **Short Entry Points**: Shows STRONG_SELL and SELL signals based exclusively on big whale orders (50+ BTC). Displays "NO SIGNAL" state when no strong sell signals detected. Entry prices align with whale resistance levels.
        - **Recommendation Logic**: Analyzes filled order flow, support/resistance levels to generate directional signals with confidence levels. Confidence thresholds: strong_buy/strong_sell require 80%+ confidence, buy/sell require 50%+ confidence.
- **Routing**: Wouter for client-side routing.

### Backend
- **Runtime**: Node.js with Express.js.
- **Data Storage**: PostgreSQL with Drizzle ORM. Uses Render PostgreSQL with SSL/TLS connection (oregon-postgres.render.com). Orders older than 7 days are automatically cleaned.
- **Real-time Communication**: WebSocket server (ws library) for broadcasting order updates.
- **Multi-Exchange Integration**: 
    - Modular architecture with unified ExchangeService interface in `server/exchanges/` folder
    - Polls 10 exchanges for order book data at staggered intervals (10-28 seconds) using public APIs
    - **Exchanges with BOTH Spot + Futures**: Binance (10s), Bybit (12s), Kraken (14s), Bitfinex (16s), OKX (20s), KuCoin (26s), HTX (28s)
    - **Exchanges with Spot Only**: Coinbase (18s), Gemini (22s), Bitstamp (24s)
    - Each exchange fetches both spot and futures order books in parallel (when available) and marks orders with `market` field ('spot' or 'futures')
    - Circuit breaker pattern for resilience: opens after 3 consecutive failures, 2-minute cooldown before retry
    - Shared validation utilities (price range, total sanity, calculation accuracy) across all exchanges
- **Order Tracking**:
    - Extracts real whale orders ($450k+ notional value) from public order books (both spot and futures markets).
    - Each order has a `market` field indicating 'spot' or 'futures' origin.
    - **Order Status Transitions**: Active orders become "Filled" when market price crosses their limit, or "Deleted" if they vanish from exchange order books.
    - Verification of existing orders uses full order book data to prevent false deletions.
    - **Design Philosophy**: Both spot and futures orders create valid support/resistance levels, so both are tracked and analyzed together.
- **API Endpoints**:
    - `GET /api/dashboard`: Consolidated primary endpoint for dashboard data (filtered orders, price, major whales) with in-memory caching.
    - `GET /api/entry-points`: Smart entry recommendations based on 50+ BTC whale orders only. Returns recommendation (strong_buy/buy/neutral/sell/strong_sell), confidence, entry price, support/resistance levels, and whale analysis.
    - Other endpoints for specific data like `/api/orders`, `/api/filled-order-analysis`, etc.
- **Performance Optimization**: Frontend uses a single dashboard endpoint, increased refetch intervals with exponential backoff. Backend utilizes in-memory caching and database composite indexes for improved response times.

## External Dependencies

- **UI Component Libraries**: Radix UI, Tailwind CSS, Lucide React, date-fns.
- **Database**: Drizzle ORM, postgres.js (Render PostgreSQL with SSL).
- **Development Tools**: Vite, TypeScript.
- **Form & Validation**: React Hook Form, Zod.
- **WebSocket**: Native WebSocket API (client), ws library (server).