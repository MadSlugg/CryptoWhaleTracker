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
- Summary statistics (24h volume, active longs/shorts)
- Real Bitcoin prices updated every 5 seconds
- Exchange badges on each order showing source exchange

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