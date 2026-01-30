// js/a_line.js
const margin = { top: 30, right: 20, bottom: 46, left: 56 };
const width = 920, height = 460;

const svg = d3.select("#chart")
  .append("svg")
  .attr("viewBox", `0 0 ${width} ${height}`);

const g = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const innerW = width - margin.left - margin.right;
const innerH = height - margin.top - margin.bottom;

d3.csv("./data/ghibli.csv", d3.autoType).then(data => {
  data.sort((a, b) => d3.ascending(a.year, b.year));

  const x = d3.scaleLinear()
    .domain(d3.extent(data, d => d.year))
    .nice()
    .range([0, innerW]);

  const y = d3.scaleLinear()
    .domain([
      d3.min(data, d => d.imdb_rating) - 0.3,
      d3.max(data, d => d.imdb_rating) + 0.3
    ])
    .nice()
    .range([innerH, 0]);

  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")));

  g.append("g")
    .call(d3.axisLeft(y));

  g.append("text")
    .attr("x", innerW / 2)
    .attr("y", innerH + 40)
    .attr("text-anchor", "middle")
    .attr("fill", "#a7b0c0")
    .attr("font-size", 12)
    .text("公開年");

  g.append("text")
    .attr("x", -innerH / 2)
    .attr("y", -42)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("fill", "#a7b0c0")
    .attr("font-size", 12)
    .text("評価（IMDb想定）");

  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.imdb_rating))
    .curve(d3.curveMonotoneX);

  g.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#19d3ff")
    .attr("stroke-width", 2.6)
    .attr("opacity", 0.9)
    .attr("d", line);

  g.selectAll("circle")
    .data(data)
    .join("circle")
    .attr("cx", d => x(d.year))
    .attr("cy", d => y(d.imdb_rating))
    .attr("r", 4.2)
    .attr("fill", "#19d3ff")
    .attr("opacity", 0.9);

  const labels = [...data]
    .sort((a, b) => d3.descending(a.imdb_rating, b.imdb_rating))
    .slice(0, 6);

  g.selectAll(".label")
    .data(labels)
    .join("text")
    .attr("class", "label")
    .attr("x", d => x(d.year) + 8)
    .attr("y", d => y(d.imdb_rating) - 10)
    .attr("font-size", 12)
    .attr("fill", "#ffffff")
    .attr("opacity", 0.88)
    .style("text-shadow", "0 1px 4px rgba(0,0,0,0.6)")
    .text(d => d.title);
});
