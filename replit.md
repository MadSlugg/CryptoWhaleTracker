# Bitcoin Whale Tracker

## Overview
The Bitcoin Whale Tracker is a real-time trading dashboard designed to monitor and display significant cryptocurrency orders (whale trades) from major exchanges. It tracks large buy and sell orders, displaying long and short positions to provide insights into market sentiment and potential price movements. The application aims to be a data-dense, utility-focused tool for cryptocurrency traders, inspired by professional platforms like Binance and TradingView. Its core purpose is to provide users with real-time, actionable intelligence on large-scale Bitcoin trading activity.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, using Vite.
- **UI**: Shadcn/ui components (Radix UI primitives) styled with Tailwind CSS, following a "new-york" theme.
- **Design Philosophy**: Utility-focused, information-dense dashboard with real-time data clarity, high-contrast indicators, minimal animations, and specific typography (Inter for text, JetBrains Mono for numbers).
- **State Management**: React Query for server state and caching, WebSocket for real-time updates, local React state for UI filters.
- **Key Features**:
    - Real-time whale order feed via WebSockets.
    - Multi-exchange tracking (Binance, Kraken, Coinbase, OKX) for orders $450k+.
    - Filterable dashboard by size, order type, exchange, time range, and status.
    - Real-time Bitcoin price updates.
    - Prominent "Major Whales Box" for top 10 largest orders (100+ BTC), independent of main filters except time range.
    - "Blockchain Whale Flow" box tracking 100+ BTC movements to/from exchanges, independent of main filters.
    - Real-time toast notifications for large orders (100+ BTC and 1000+ BTC "MEGA WHALE").
    - Volume-weighted long/short summary statistics.
    - "Whale Analytics System" including:
        - **Filled Order Flow**: Time-decay weighted analysis of whale executions over a fixed 30-minute window for price direction prediction.
        - **Price Clusters**: Liquidation heatmap showing concentration of active whale orders at price levels.
        - **Order Book Imbalance**: Real-time supply/demand pressure indicator from active whale orders.
        - **Large Price Level Heatmap**: Visual map of active whale concentration (50+ BTC orders) across price levels.
    - Dedicated sections for "Active Orders" and "Filled Orders" displaying the 5 most recent entries.
- **Routing**: Wouter for client-side routing.

### Backend
- **Runtime**: Node.js with Express.js.
- **Data Storage**: PostgreSQL database with Drizzle ORM for persistent storage of all tracking data (orders, whale movements, ratios), hosted on Neon serverless. Orders older than 7 days are automatically cleaned.
- **Real-time Communication**: WebSocket server (ws library) for broadcasting updates.
- **Multi-Exchange Integration**: Polling public APIs of Binance, Kraken, Coinbase, and OKX for order book data and real-time prices. Polling intervals are staggered.
- **Blockchain Transaction Monitoring**: Fetches 100+ BTC whale transactions from Blockchain.info API, analyzing inputs/outputs to accurately identify deposits to/withdrawals from exchanges. Tracks 20 exchange wallets across 7 major platforms.
- **Order Tracking**:
    - Extracts real whale orders ($450k+ notional value) from public order book depth.
    - Each order tagged with its source exchange.
    - Orders transition from "Active" to "Filled" when market price crosses their limit price, and "Active" to "Deleted" if they vanish from exchange order books.
    - A rigorous verification process against full order books prevents false deletions.
- **API Endpoints**: Provides endpoints for retrieving filtered orders, filled order analysis, whale movements, long/short ratios, liquidations, whale correlations, and blockchain transactions.
- **Data Cleanup**: Automated hourly cleanup of orders older than 7 days.

## External Dependencies
- **UI Component Libraries**: Radix UI, Tailwind CSS, Lucide React, date-fns.
- **Database**: Drizzle ORM (PostgreSQL), Neon Database serverless driver.
- **Development Tools**: Vite, TypeScript.
- **Form & Validation**: React Hook Form, Zod.
- **WebSocket**: Native WebSocket API (client), `ws` library (server).
- **Other**: `connect-pg-simple` (configured but currently unused for sessions).