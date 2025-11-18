# Bitcoin Trading Tracker Design Guidelines

## Design Approach: Crypto Trading Dashboard System

**Selected Approach:** Utility-focused dashboard design inspired by trading platforms like Binance, Coinbase Pro, and TradingView. Emphasis on information density, real-time data clarity, and risk visualization.

**Core Principles:**
- Data-first hierarchy: Information legibility over decorative elements
- High-contrast risk indicators: Instant visual recognition of danger levels
- Scannable layouts: Rapid information processing for time-sensitive decisions
- Minimal distractions: Zero unnecessary animations to maintain focus

---

## Typography

**Font Stack:** 
- Primary: `'Inter', system-ui, sans-serif` (data readability)
- Monospace: `'JetBrains Mono', 'Courier New', monospace` (numbers, prices, timestamps)

**Hierarchy:**
- Page Title: text-2xl font-bold
- Section Headers: text-lg font-semibold
- Data Labels: text-sm font-medium uppercase tracking-wide
- Primary Data (Prices/Amounts): text-lg font-mono font-semibold
- Secondary Data (Timestamps/Details): text-sm font-mono
- Alert Text: text-base font-bold

---

## Layout System

**Spacing Units:** Tailwind spacing of 2, 4, 6, and 8 for tight, data-dense layouts. Use p-4 for cards, gap-4 for grids, py-6 for sections.

**Grid Structure:**
- Main Dashboard: 12-column grid (grid-cols-12)
- Summary Stats Bar: 4-column grid on desktop (grid-cols-1 md:grid-cols-4)
- Order Feed: Single column with full-width cards
- Leverage Distribution: 3-column grid (grid-cols-1 md:grid-cols-3)

**Container:** max-w-7xl mx-auto px-4

---

## Component Library

### 1. Dashboard Header
- Fixed top position with page title and last update timestamp
- Live status indicator (pulsing dot)
- Filter controls (size threshold, leverage minimum)

### 2. Summary Statistics Cards
Four prominent cards displaying:
- Total 24h Volume (BTC icon + number)
- Active Long Positions (up arrow + count)
- Active Short Positions (down arrow + count)
- Average Leverage (multiplier icon + ratio)

Card structure: Rounded borders (rounded-lg), padding p-6, shadow-sm

### 3. High-Risk Alert Banner
- Full-width banner when high-leverage positions detected
- Warning icon + message + count of risky positions
- Conditional display based on leverage threshold

### 4. Order Feed Cards
Each order displays:
- Position type badge (Long/Short with background indicators)
- BTC amount in large monospace font
- Entry price
- Leverage multiplier with risk indicator
- Timestamp
- Liquidation price (if applicable)

Layout: Stacked vertically with separator lines, rounded-lg borders, p-4 padding

### 5. Leverage Risk Indicator
Visual bar or badge system:
- 1-5x: Minimal risk
- 5-10x: Moderate risk  
- 10-25x: High risk
- 25x+: Extreme risk

### 6. Filter Controls
- Dropdown for minimum order size (e.g., ≥1 BTC, ≥5 BTC, ≥10 BTC)
- Dropdown for leverage filter (All, 10x+, 25x+, 50x+)
- Time range selector (1h, 4h, 24h, 7d)

### 7. Empty States
When no orders match filters: Centered icon + message

---

## Navigation

**Top Navigation Bar:**
- Logo/Title (left)
- Filter controls (center)
- Refresh button + Auto-refresh toggle (right)

Simple, single-level navigation - this is a focused tool, not a multi-page site.

---

## Data Visualization Elements

**Order Type Indicators:**
- Long positions: Upward arrow icon
- Short positions: Downward arrow icon
- Position badges with text labels

**Leverage Display:**
- Prominent multiplier (e.g., "25x") 
- Background intensity scales with risk level
- Icon indicator for extreme leverage (⚠️)

**Timestamp Format:**
- Relative time for recent orders ("2m ago", "1h ago")
- Absolute time for older orders ("Jan 15, 14:30 UTC")

---

## Responsive Behavior

**Desktop (lg+):**
- 4-column stats grid
- 3-column leverage distribution
- Side-by-side order details

**Tablet (md):**
- 2-column stats grid
- 2-column leverage distribution
- Stacked order cards with reduced padding

**Mobile (base):**
- Single column all sections
- Condensed card padding (p-3)
- Simplified order details (priority info only)

---

## Accessibility

- High contrast ratios for all text on backgrounds (WCAG AA minimum)
- Consistent icon usage with aria-labels
- Keyboard navigation for all filter controls
- Screen reader announcements for new high-risk orders

---

## Performance Considerations

- Virtual scrolling for order feed if >50 items
- Debounced filter updates
- Efficient re-rendering for real-time data
- Icons from Heroicons via CDN

---

**Key Design Note:** This is a professional trading tool, not a marketing page. Prioritize information density, scanning efficiency, and zero decorative distractions. Every pixel serves the purpose of helping traders identify large, high-risk positions instantly.