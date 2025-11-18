import { useRef, useEffect } from "react";
import * as d3 from "d3";
import type { BitcoinOrder } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DepthChartProps {
  orders: BitcoinOrder[];
  currentPrice: number;
  title?: string;
}

interface PriceLevel {
  price: number;
  totalSize: number;
  count: number;
}

export function DepthChart({ orders, currentPrice, title = "Order Book Depth" }: DepthChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const margin = { top: 20, right: 20, bottom: 40, left: 60 };
    // Use container width or fallback to a minimum width
    const containerWidth = containerRef.current.clientWidth || 800;
    const width = Math.max(containerWidth - margin.left - margin.right, 400);
    const height = 300 - margin.top - margin.bottom;

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();

    // If no orders, render empty chart with axes and price line only
    if (orders.length === 0) {
      const svg = d3.select(svgRef.current)
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

      const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // Create minimal scales around current price
      const xScale = d3.scaleLinear()
        .domain([currentPrice * 0.95, currentPrice * 1.05])
        .range([0, width]);

      const yScale = d3.scaleLinear()
        .domain([0, 100])
        .range([height, 0]);

      // Draw current price line
      g.append("line")
        .attr("x1", xScale(currentPrice))
        .attr("x2", xScale(currentPrice))
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "hsl(var(--foreground))")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5")
        .attr("opacity", 0.6);

      // Add price label
      g.append("text")
        .attr("x", xScale(currentPrice))
        .attr("y", -5)
        .attr("text-anchor", "middle")
        .attr("fill", "hsl(var(--foreground))")
        .attr("font-size", "12px")
        .attr("font-family", "var(--font-mono)")
        .text(`$${currentPrice.toLocaleString()}`);

      // Add axes
      const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickFormat(d => `$${(d as number / 1000).toFixed(0)}k`);

      const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => `${d} BTC`);

      g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis)
        .attr("color", "hsl(var(--muted-foreground))");

      g.append("g")
        .call(yAxis)
        .attr("color", "hsl(var(--muted-foreground))");

      return;
    }

    // Separate buy and sell orders
    const buyOrders = orders.filter(o => o.type === 'long').sort((a, b) => b.price - a.price);
    const sellOrders = orders.filter(o => o.type === 'short').sort((a, b) => a.price - b.price);

    // Aggregate orders by price level (round to nearest $100)
    const aggregateToPriceLevels = (orders: BitcoinOrder[]): PriceLevel[] => {
      const levels = new Map<number, PriceLevel>();
      
      orders.forEach(order => {
        const priceLevel = Math.round(order.price / 100) * 100;
        const existing = levels.get(priceLevel);
        if (existing) {
          existing.totalSize += order.size;
          existing.count += 1;
        } else {
          levels.set(priceLevel, { price: priceLevel, totalSize: order.size, count: 1 });
        }
      });

      return Array.from(levels.values()).sort((a, b) => a.price - b.price);
    };

    const buyLevels = aggregateToPriceLevels(buyOrders);
    const sellLevels = aggregateToPriceLevels(sellOrders);

    // Calculate cumulative depth
    let buyCumulative = 0;
    const buyDepth = buyLevels.reverse().map(level => {
      buyCumulative += level.totalSize;
      return { price: level.price, depth: buyCumulative, count: level.count };
    }).reverse();

    let sellCumulative = 0;
    const sellDepth = sellLevels.map(level => {
      sellCumulative += level.totalSize;
      return { price: level.price, depth: sellCumulative, count: level.count };
    });

    // Create scales
    const allPrices = [...buyDepth.map(d => d.price), ...sellDepth.map(d => d.price)];
    const minPrice = Math.min(...allPrices, currentPrice * 0.95);
    const maxPrice = Math.max(...allPrices, currentPrice * 1.05);

    const xScale = d3.scaleLinear()
      .domain([minPrice, maxPrice])
      .range([0, width]);

    const maxDepth = Math.max(
      buyDepth.length > 0 ? Math.max(...buyDepth.map(d => d.depth)) : 0,
      sellDepth.length > 0 ? Math.max(...sellDepth.map(d => d.depth)) : 0
    );

    const yScale = d3.scaleLinear()
      .domain([0, maxDepth * 1.1])
      .range([height, 0]);

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add gradient fills
    const defs = svg.append("defs");

    const buyGradient = defs.append("linearGradient")
      .attr("id", "buy-gradient")
      .attr("x1", "0%")
      .attr("x2", "0%")
      .attr("y1", "0%")
      .attr("y2", "100%");

    buyGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "hsl(var(--long))")
      .attr("stop-opacity", 0.3);

    buyGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "hsl(var(--long))")
      .attr("stop-opacity", 0.05);

    const sellGradient = defs.append("linearGradient")
      .attr("id", "sell-gradient")
      .attr("x1", "0%")
      .attr("x2", "0%")
      .attr("y1", "0%")
      .attr("y2", "100%");

    sellGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "hsl(var(--short))")
      .attr("stop-opacity", 0.3);

    sellGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "hsl(var(--short))")
      .attr("stop-opacity", 0.05);

    // Draw buy area
    if (buyDepth.length > 0) {
      const buyArea = d3.area<{ price: number; depth: number }>()
        .x(d => xScale(d.price))
        .y0(height)
        .y1(d => yScale(d.depth))
        .curve(d3.curveStepAfter);

      g.append("path")
        .datum(buyDepth)
        .attr("fill", "url(#buy-gradient)")
        .attr("d", buyArea);

      g.append("path")
        .datum(buyDepth)
        .attr("fill", "none")
        .attr("stroke", "hsl(var(--long))")
        .attr("stroke-width", 2)
        .attr("d", d3.line<{ price: number; depth: number }>()
          .x(d => xScale(d.price))
          .y(d => yScale(d.depth))
          .curve(d3.curveStepAfter)
        );
    }

    // Draw sell area
    if (sellDepth.length > 0) {
      const sellArea = d3.area<{ price: number; depth: number }>()
        .x(d => xScale(d.price))
        .y0(height)
        .y1(d => yScale(d.depth))
        .curve(d3.curveStepBefore);

      g.append("path")
        .datum(sellDepth)
        .attr("fill", "url(#sell-gradient)")
        .attr("d", sellArea);

      g.append("path")
        .datum(sellDepth)
        .attr("fill", "none")
        .attr("stroke", "hsl(var(--short))")
        .attr("stroke-width", 2)
        .attr("d", d3.line<{ price: number; depth: number }>()
          .x(d => xScale(d.price))
          .y(d => yScale(d.depth))
          .curve(d3.curveStepBefore)
        );
    }

    // Draw current price line
    g.append("line")
      .attr("x1", xScale(currentPrice))
      .attr("x2", xScale(currentPrice))
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "hsl(var(--foreground))")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,5")
      .attr("opacity", 0.6);

    // Add price label
    g.append("text")
      .attr("x", xScale(currentPrice))
      .attr("y", -5)
      .attr("text-anchor", "middle")
      .attr("fill", "hsl(var(--foreground))")
      .attr("font-size", "12px")
      .attr("font-family", "var(--font-mono)")
      .text(`$${currentPrice.toLocaleString()}`);

    // Add axes
    const xAxis = d3.axisBottom(xScale)
      .ticks(5)
      .tickFormat(d => `$${(d as number / 1000).toFixed(0)}k`);

    const yAxis = d3.axisLeft(yScale)
      .ticks(5)
      .tickFormat(d => `${d} BTC`);

    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis)
      .attr("color", "hsl(var(--muted-foreground))");

    g.append("g")
      .call(yAxis)
      .attr("color", "hsl(var(--muted-foreground))");

    // Add axis labels
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height + 35)
      .attr("text-anchor", "middle")
      .attr("fill", "hsl(var(--muted-foreground))")
      .attr("font-size", "12px")
      .text("Price");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -45)
      .attr("text-anchor", "middle")
      .attr("fill", "hsl(var(--muted-foreground))")
      .attr("font-size", "12px")
      .text("Cumulative Size");

  }, [orders, currentPrice]);

  return (
    <Card data-testid="card-depth-chart">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="w-full relative">
          <svg ref={svgRef} className="w-full" data-testid="svg-depth-chart" />
          {orders.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground pointer-events-none">
              No active orders to display
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
