# Bitcoin Whale Tracker

## Overview

A real-time Bitcoin trading dashboard that monitors and displays large cryptocurrency orders with leverage analysis. The application simulates whale trading activity, tracking long and short positions with detailed risk assessment based on leverage levels. Built as a data-dense, utility-focused dashboard inspired by professional trading platforms like Binance and TradingView.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool

**UI Component System**: Shadcn/ui components built on Radix UI primitives, configured in "new-york" style with Tailwind CSS for styling

**Design Philosophy**: 
- Utility-focused trading dashboard with emphasis on information density and real-time data clarity
- High-contrast risk indicators for instant visual recognition
- Minimal animations to maintain focus on critical trading data
- Typography uses Inter for general text and JetBrains Mono for numerical data (prices, amounts, timestamps)

**State Management**:
- React Query (@tanstack/react-query) for server state management and caching
- WebSocket connection for real-time order updates
- Local React state for UI filters and controls

**Key Features**:
- Real-time order feed with WebSocket updates
- Complete position lifecycle tracking (open and closed positions)
- Profit/loss calculation for closed positions with color-coded indicators
- Filterable dashboard (by size, leverage, order type, time range, and status)
- Summary statistics (24h volume, active longs/shorts, average leverage)
- High-risk alerts for positions with 25x+ leverage
- Risk level categorization (minimal, moderate, high, extreme)

**Routing**: Wouter for client-side routing

### Backend Architecture

**Runtime**: Node.js with Express.js server

**Data Storage**: In-memory storage (MemStorage class) - no persistent database currently implemented, though Drizzle ORM is configured for potential PostgreSQL integration

**Real-time Communication**: WebSocket server (ws library) for broadcasting order updates to connected clients

**Binance Integration**: Real-time Bitcoin data integration with Binance API:
- Real Bitcoin prices fetched from Binance ticker API every 5 seconds
- Real whale orders extracted from Binance order book depth (orders with $450k+ notional value)
- Order book polling every ~10 seconds to detect new large buy/sell orders
- Fallback to last known price with small drift if API temporarily unavailable
- Uses data-api.binance.vision endpoint (market data-only) to avoid geo-restrictions

**Order Generation**: Mixed data source combining real and simulated orders:
- Real whale orders from Binance order book (large buy/sell orders)
- Simulated orders generated every ~12.5 seconds for additional activity
- Size distribution favoring smaller orders with occasional whale trades
- Leverage between 1x-50x (simulated, as order book doesn't expose leverage)
- Automatic liquidation price calculation
- Batch initial data generation (15 orders) on startup
- Automatic position closing mechanism that randomly closes open positions every 5-15 seconds
- Profit/loss calculation based on entry/exit price and leverage

**API Endpoints**:
- `GET /api/orders` - Retrieve filtered orders with query parameters for minSize, minLeverage, orderType, and timeRange

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