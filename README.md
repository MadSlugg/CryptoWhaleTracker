# Bitcoin Whale Tracker

A real-time Bitcoin trading dashboard that monitors and displays large cryptocurrency orders ($450k+) from multiple exchanges including Binance, Kraken, Coinbase, and OKX.

![Bitcoin Whale Tracker](https://img.shields.io/badge/Bitcoin-Whale_Tracker-orange?style=for-the-badge&logo=bitcoin)
![Status](https://img.shields.io/badge/Status-Live-success?style=for-the-badge)

## 🚀 Features

### Real-Time Whale Tracking
- **Multi-Exchange Support**: Monitors Binance, Kraken, Coinbase, and OKX
- **Large Order Detection**: Tracks orders with $450k+ notional value
- **Live Price Updates**: Bitcoin prices updated every 5 seconds
- **WebSocket Integration**: Real-time order updates pushed to clients

### Advanced Analytics

#### 📊 Major Whales Display
- Shows top 10 largest orders (100+ BTC minimum)
- MEGA WHALE badge for 1000+ BTC orders
- Real-time alerts for large whale activity
- Independent from user filters for authoritative view

#### 📈 Filled Order Flow Analysis
- Time-weighted analysis of whale executions (30-minute window)
- Predicts price direction based on whale execution patterns
- Volume-weighted long/short ratios
- Signal strength indicators (STRONG ACCUMULATION → STRONG DISTRIBUTION)

#### 🎯 Price Level Heatmap
- Visual concentration map of 50+ BTC orders
- Color-coded by volume intensity
- Shows long/short breakdown at each price level
- Highlights current Bitcoin price

#### 🎲 Price Clusters (Liquidation Heatmap)
- Identifies whale concentration at similar price levels
- Shows support/resistance zones
- Long/short breakdown per cluster
- Filters out insignificant single-order levels

#### ⚖️ Order Book Imbalance
- Real-time supply/demand pressure indicator
- Shows bid (buy) vs ask (sell) liquidity
- Pressure level badges (STRONG BUY/SELL → BALANCED)
- Total active liquidity display

### Dashboard Features
- **Smart Filtering**: Filter by size, order type, exchange, time range, and status
- **Order Status Tracking**: Active and Filled orders with automatic transitions
- **Exchange Badges**: Identify source exchange for each order
- **Responsive Design**: Professional trading dashboard interface

## 🏗️ Architecture

### Frontend
- **React** with TypeScript
- **Shadcn/ui** components with Radix UI primitives
- **Tailwind CSS** for styling
- **React Query** for state management
- **WebSocket** for real-time updates

### Backend
- **Node.js** with Express.js
- **PostgreSQL** with Neon serverless database
- **Drizzle ORM** for database operations
- **WebSocket Server** (ws library) for real-time broadcasting

### Data Philosophy
**"Not every trade is equal"** - All metrics are weighted by BTC volume, not order count. Bigger trades have proportionally more impact on analysis.

## 📦 Installation

### Prerequisites
- Node.js 20+
- PostgreSQL database (or Neon serverless)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/MadSlugg/CryptoWhaleTracker.git
   cd CryptoWhaleTracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file:
   ```env
   DATABASE_URL=postgresql://user:password@host:5432/database
   SESSION_SECRET=your_secret_key_here
   NODE_ENV=development
   ```

4. **Push database schema**
   ```bash
   npm run db:push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open in browser**
   Navigate to `http://localhost:5000`

## 🌐 Deployment

See [DEPLOY.md](DEPLOY.md) for detailed instructions on deploying to Render for free.

Quick summary:
1. Create free PostgreSQL database on [Neon](https://neon.tech)
2. Deploy to [Render](https://render.com) from GitHub
3. Configure environment variables
4. Initialize database schema

## 🔧 Configuration

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Secret key for session management
- `NODE_ENV` - Environment mode (development/production)

### Database Cleanup
- Orders older than 7 days are automatically cleaned up
- Cleanup runs every hour

## 📊 Data Coverage

The system tracks approximately **25-30% of BTC liquidity** in the top 100 price levels per exchange, focusing on large whale orders that indicate significant market activity.

## 🎯 Key Metrics

### Time-Decay Weighting
Filled Order Flow uses exponential time decay:
- 5 minutes old = 85% weight
- 10 minutes old = 71% weight
- 30 minutes old = 37% weight
- 1 hour old = 14% weight
- 2 hours old = 2% weight

### Order Detection
- **Discovery**: Orders $450k+ within ±20% of current market price
- **Verification**: Checks against full order book regardless of filters
- **Deduplication**: 5-minute window for recently filled orders

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn/ui
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM
- **Real-time**: WebSocket (ws library)
- **Charts**: D3.js, Recharts
- **Build**: Vite, esbuild

## 📝 API Endpoints

- `GET /api/orders` - Retrieve filtered orders
- `GET /api/filled-order-analysis` - Analyze filled orders for price prediction
- `GET /api/whale-movements` - Retrieve whale movement data
- `GET /api/long-short-ratios` - Retrieve long/short ratio history
- `GET /api/liquidations` - Retrieve liquidation events

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - feel free to use this project for your own purposes.

## 🔗 Links

- **Live Demo**: [Your Render URL here]
- **GitHub**: https://github.com/MadSlugg/CryptoWhaleTracker
- **Issues**: https://github.com/MadSlugg/CryptoWhaleTracker/issues

## ⚠️ Disclaimer

This tool is for educational and informational purposes only. It is not financial advice. Always do your own research before making trading decisions.

---

**Built with ❤️ for the crypto trading community**
