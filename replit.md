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
- **Data Storage**: PostgreSQL with Drizzle ORM (optional for historical data). Primary data flow uses in-memory aggregation.
- **Real-time Communication**: WebSocket server (ws library) for broadcasting liquidity snapshot updates.
- **Architecture (Nov 22, 2024 Refactor)**:
    - **In-Memory Price-Level Aggregation**: Replaced per-order database tracking with LiquiditySnapshotService that aggregates raw order book data by $100 price buckets in real-time
    - **Motivation**: Exchanges don't provide stable order IDs, causing massive duplication (1.85M BTC at single price level). Solution: Aggregate by price buckets instead of tracking individual orders.
    - **Result**: Clean aggregation showing 30-40K BTC total across 29-30 price levels (vs previous 1.85M+ BTC duplication)
- **Multi-Exchange Integration**: 
    - Modular architecture with unified ExchangeService interface in `server/exchanges/` folder
    - Polls 10 exchanges for order book data at staggered intervals (10-28 seconds) using public APIs
    - **Exchanges with BOTH Spot + Futures**: Binance (10s), Bybit (12s), Kraken (14s), Bitfinex (16s), OKX (20s), KuCoin (26s), HTX (28s)
    - **Exchanges with Spot Only**: Coinbase (18s), Gemini (22s), Bitstamp (24s)
    - Circuit breaker pattern for resilience: opens after 3 consecutive failures, 2-minute cooldown before retry
    - Shared validation utilities (price range, total sanity, calculation accuracy) across all exchanges
- **Liquidity Aggregation (LiquiditySnapshotService)**:
    - Fetches raw order book data from all 10 exchanges in parallel
    - Filters large orders (100+ BTC) from both spot and futures markets
    - Aggregates orders into $100 price buckets with buy/sell liquidity totals
    - Tracks which exchanges contribute to each price level
    - Updates every ~10 seconds with fresh market snapshot
    - No database writes - pure in-memory aggregation for performance
- **API Endpoints**:
    - `GET /api/liquidity-levels`: Returns current liquidity snapshot (timestamp, currentPrice, aggregated price levels with buy/sell liquidity)
    - `GET /api/entry-points`: Confidence-based entry recommendations using liquidity snapshot data. Combines spot liquidity strength (1000+BTC=80% base, 500+BTC=65%, etc.) with futures market alignment bonuses/penalties (±10-15%). Returns recommendation (strong_buy/buy/neutral/sell/strong_sell), confidence, entry price, support/resistance levels, futures positioning data, and detailed market analysis reasoning.
    - `GET /api/dashboard`: Legacy endpoint (may be deprecated in favor of direct liquidity-levels consumption)
- **Performance Optimization**: In-memory aggregation eliminates database write overhead. WebSocket broadcasts snapshot updates to connected clients. Frontend refetch intervals use exponential backoff.

## External Dependencies

- **UI Component Libraries**: Radix UI, Tailwind CSS, Lucide React, date-fns.
- **Database**: Drizzle ORM, postgres.js (Render PostgreSQL with SSL).
- **Development Tools**: Vite, TypeScript.
- **Form & Validation**: React Hook Form, Zod.
- **WebSocket**: Native WebSocket API (client), ws library (server).