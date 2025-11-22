# Bitcoin Liquidity Monitor

## Overview
A real-time Bitcoin trading dashboard designed to monitor and display large cryptocurrency positions from multiple exchanges. It tracks real-time buy and sell liquidity, providing a data-dense, utility-focused interface for professional traders. The project aims to offer critical insights into market movements driven by significant capital flows, enhancing strategic trading decisions.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, using Vite.
- **UI/UX**: Shadcn/ui components (Radix UI based) with Tailwind CSS, "new-york" style. Focus on information density, real-time data clarity, high-contrast indicators, minimal animations. Uses Inter for text and JetBrains Mono for numerical data.
- **State Management**: React Query for server state, WebSockets for real-time updates, local React state for UI filters.
- **Key Features**:
    - Real-time large position tracking from 10 exchanges: Binance, Bybit, Kraken, Bitfinex, Coinbase, OKX, Gemini, Bitstamp, KuCoin, and HTX (positions >= $8.4M / 100+ BTC).
    - **Market Type Tracking**: Each position labeled as SPOT or FUTURES. 7 exchanges track both spot and futures (Binance, Bybit, OKX, KuCoin, HTX, Kraken, Bitfinex), 3 track spot only (Coinbase, Gemini, Bitstamp).
    - Filterable dashboard by size, position type, exchange, time range, and status.
    - Real Bitcoin prices (updated every 5 seconds).
    - **Dashboard Layout**: Header (BTC price, date, refresh controls), Filter Controls, Buy/Sell Entry Points (side-by-side directional recommendations with confidence scores), Support & Resistance Levels (price zones where large positions are concentrated).
    - **Confidence-Based Entry Points**: Combines spot liquidity strength with futures market alignment to generate actionable buy/sell signals with clear confidence percentages (15-95%). Uses strict thresholds: STRONG signals require 80%+ confidence, regular signals require 50%+, below 50% shows NO SIGNAL state.
    - **Market Analytics**:
        - **Filled Order Flow**: Time-decay weighted analysis of large executions in the last 30 minutes, showing accumulation/distribution signals from both spot and futures markets.
        - **Support & Resistance Levels**: Identifies strong price zones from active positions concentrated at price levels (2+ positions or 50+ BTC total). Displays only BTC liquidity amounts. Both spot and futures positions create valid support/resistance levels.
        - **Buy Entry Points**: Shows STRONG_BUY and BUY signals based on market liquidity analysis. Displays "NO SIGNAL" state when no strong buy signals detected. Entry prices align with support levels. Shows "Market Analysis" reasoning.
        - **Sell Entry Points**: Shows STRONG_SELL and SELL signals based on market liquidity analysis. Displays "NO SIGNAL" state when no strong sell signals detected. Entry prices align with resistance levels. Shows "Market Analysis" reasoning.
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
    - Extracts large positions ($8.4M+ notional value / 100+ BTC) from public order books (both spot and futures markets).
    - Each position has a `market` field indicating 'spot' or 'futures' origin.
    - **Deduplication Logic**: Prevents duplicate positions by checking exchange, type, price (±0.01), size (±0.01), market, and status. Market field is normalized to 'spot' default before comparison to ensure consistent matching whether upstream data includes market field or not. Active positions or positions filled within last 5 minutes are checked for duplicates.
    - **Position Status Transitions (CRITICAL FIX - Nov 22, 2024)**:
        - **Problem**: Positions marked filled on price cross alone → caused 3,345+ false fills per 10 minutes (1.1M BTC!)
        - **Solution**: Positions marked filled ONLY when BOTH conditions met:
          1. Market price crosses the position's limit level
          2. Position confirmed missing from exchange order book for **2+ consecutive polls** (prevents API hiccups)
        - **Result**: False positives eliminated. Fill rate reduced from 300+/min to ~50-60/min (realistic executions only)
    - Verification of existing positions uses full order book data to prevent false deletions.
    - **Design Philosophy**: Both spot and futures positions create valid support/resistance levels, so both are tracked and analyzed together.
- **API Endpoints**:
    - `GET /api/dashboard`: Consolidated primary endpoint for dashboard data (BTC price snapshot, active orders for analysis) with in-memory caching.
    - `GET /api/entry-points`: Confidence-based entry recommendations combining spot liquidity strength (1000+BTC=80% base, 500+BTC=65%, etc.) with futures market alignment bonuses/penalties (±10-15%). Returns recommendation (strong_buy/buy/neutral/sell/strong_sell), confidence, entry price, support/resistance levels, futures positioning data, and detailed market analysis reasoning.
    - Other endpoints for specific data like `/api/orders`, `/api/filled-order-analysis`, etc.
- **Performance Optimization**: Frontend uses a single dashboard endpoint, increased refetch intervals with exponential backoff. Backend utilizes in-memory caching and database composite indexes for improved response times.

## External Dependencies

- **UI Component Libraries**: Radix UI, Tailwind CSS, Lucide React, date-fns.
- **Database**: Drizzle ORM, postgres.js (Render PostgreSQL with SSL).
- **Development Tools**: Vite, TypeScript.
- **Form & Validation**: React Hook Form, Zod.
- **WebSocket**: Native WebSocket API (client), ws library (server).